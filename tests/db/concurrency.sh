#!/usr/bin/env bash
# Co-op race tests (tagging): both partners post and tag each other at the same moment.
# Expectation: the first post closes the co-op stage for both, the second gets STAGE_NOT_ACTIVE,
# no deadlocks, nothing stuck in "waiting_partner", coins paid exactly once.
set -euo pipefail
URL="$1"
q() { psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }

PAIRS=12
setup_pair() { # $1 = pair number
  local x y
  x=$(printf '10000000-0000-0000-0000-%012d' "$1")
  y=$(printf '20000000-0000-0000-0000-%012d' "$1")
  q "insert into auth.users (id) values ('$x'), ('$y');
     select public.create_onboarding('$x', testkit.profile('Px$1', 'WA', 'Seattle', 'solo'), testkit.interests('running','spanish','guitar'), testkit.stages('running','spanish','guitar'));
     select public.create_onboarding('$y', testkit.profile('Py$1', 'WA', 'Seattle', 'solo'), testkit.interests('running','cooking','chess'),  testkit.stages('running','cooking','chess'));
     select public.request_connection('$x', '$y', 'running');
     select public.respond_connection('$y', (select id from connections where from_id = '$x'), 'accepted');
     select public.complete_stage('$x', testkit.stage('$x', 'running', 1), null, null, 'public', null);
     select public.complete_stage('$y', testkit.stage('$y', 'running', 1), null, null, 'public', null);" >/dev/null
  echo "$x $y"
}
coop_sql() { # $1 = user, $2 = partner
  echo "select public.complete_stage('$1', testkit.stage('$1','running',3), '$1/' || testkit.stage('$1','running',3) || '/c.jpg', '', 'public', '$2');"
}

# --- 1) deterministic interleaving: X holds its transaction open, Y arrives meanwhile ---
read -r X Y < <(setup_pair 0)
psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "begin; $(coop_sql "$X" "$Y") select pg_sleep(1.5); commit;" >/dev/null &
S1=$!
sleep 0.4
if OUT=$(psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$(coop_sql "$Y" "$X")" 2>&1); then
  echo "FAIL interleaving: Y's stage was already closed by X's tag, expected STAGE_NOT_ACTIVE: $OUT"; exit 1
fi
wait $S1
echo "$OUT" | grep -q 'STAGE_NOT_ACTIVE' || { echo "FAIL interleaving: unexpected error: $OUT"; exit 1; }
[ "$(q "select count(*) from roadmap_stages where interest_slug='running' and kind='coop' and status='done' and user_id in ('$X','$Y')")" = "2" ] \
  || { echo "FAIL interleaving: both stages must be done"; exit 1; }

# --- 2) stress: many pairs, both partners fire at the same instant ---
declare -a XS YS
for i in $(seq 1 $PAIRS); do read -r XS[i] YS[i] < <(setup_pair "$i"); done
PIDS=()
for i in $(seq 1 $PAIRS); do
  psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$(coop_sql "${XS[i]}" "${YS[i]}")" >/dev/null 2>/tmp/k7_race_x_$i & PIDS+=($!)
  psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$(coop_sql "${YS[i]}" "${XS[i]}")" >/dev/null 2>/tmp/k7_race_y_$i & PIDS+=($!)
done
for p in "${PIDS[@]}"; do wait "$p" || true; done
# the only acceptable error is the loser of a race finding its stage already closed
if grep -h 'ERROR' /tmp/k7_race_* 2>/dev/null | grep -v 'STAGE_NOT_ACTIVE' | grep -q .; then
  echo "FAIL stress: unexpected error (deadlock?):"; cat /tmp/k7_race_*; exit 1
fi
NOT_DONE=$(q "select count(*) from roadmap_stages where kind='coop' and interest_slug='running' and status <> 'done' and user_id in (select id from profiles where display_name ~ '^P[xy][0-9]+$')")
[ "$NOT_DONE" = "0" ] || { echo "FAIL stress: $NOT_DONE co-op stages not done"; exit 1; }
STUCK=$(q "select count(*) from roadmap_stages where kind='coop' and status='waiting_partner'")
[ "$STUCK" = "0" ] || { echo "FAIL stress: $STUCK co-op stages stuck in waiting_partner"; exit 1; }
BAD=$(q "select count(*) from profiles p where p.coins <> coalesce((select sum(amount) from coin_ledger l where l.user_id = p.id),0)")
[ "$BAD" = "0" ] || { echo "FAIL stress: coins out of sync with ledger for $BAD users"; exit 1; }
# per pair: poster 1 + 1 + 2 photo + 1 stage + 1 bonus = 6, tagged buddy 1 + 1 + 1 stage + 1 bonus = 4
WRONG=$(q "select count(*) from (select sum(coins) s from profiles where display_name ~ '^P[xy][0-9]+$' group by substring(display_name from 3)) t where s <> 10")
[ "$WRONG" = "0" ] || { echo "FAIL stress: $WRONG pairs have wrong coin totals"; q "select substring(display_name from 3) pair, string_agg(display_name || '=' || coins, ' ' order by display_name) from profiles where display_name ~ '^P[xy][0-9]+$' group by 1 having sum(coins) <> 10"; exit 1; }
rm -f /tmp/k7_race_*
echo "CONCURRENCY PASSED ($PAIRS simultaneous pairs + interleaving)"
