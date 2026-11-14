#!/usr/bin/env bash
# Co-op race tests: both partners upload their photo at the same moment.
# Expectation: no deadlocks, no stuck "waiting_partner", coins paid exactly once.
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
OUT=$(psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$(coop_sql "$Y" "$X")")
wait $S1
echo "$OUT" | grep -q '"waitingForPartner": false' || { echo "FAIL interleaving: second partner should finish both: $OUT"; exit 1; }
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
FAILED=0
for p in "${PIDS[@]}"; do wait "$p" || FAILED=1; done
if [ "$FAILED" = "1" ]; then echo "FAIL stress: a transaction errored:"; cat /tmp/k7_race_* ; exit 1; fi

STUCK=$(q "select count(*) from roadmap_stages where kind='coop' and status='waiting_partner'")
[ "$STUCK" = "0" ] || { echo "FAIL stress: $STUCK co-op stages stuck in waiting_partner"; exit 1; }
BAD=$(q "select count(*) from profiles p where p.coins <> coalesce((select sum(amount) from coin_ledger l where l.user_id = p.id),0)")
[ "$BAD" = "0" ] || { echo "FAIL stress: coins out of sync with ledger for $BAD users"; exit 1; }
# every racer: 1 (stage1) + 1 (connect) + 2 (photo) + 1 (coop stage) + 1 (coop bonus) = 6
WRONG=$(q "select count(*) from profiles where display_name like 'P%' and coins <> 6")
[ "$WRONG" = "0" ] || { echo "FAIL stress: $WRONG racers have wrong coin totals"; exit 1; }
rm -f /tmp/k7_race_*
echo "CONCURRENCY PASSED ($PAIRS simultaneous pairs + interleaving)"
