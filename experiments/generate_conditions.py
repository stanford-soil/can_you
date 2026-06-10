#!/usr/bin/env python3
"""
generate_conditions.py — shared block-randomization for all studies

usage:
  python generate_conditions.py              # default: 4 conditions, 500 participants
  python generate_conditions.py 2            # 2 conditions (e.g. main_study GR/RG)
  python generate_conditions.py 4 500        # explicit: 4 conditions, 500 participants

paste output into ASSIGNMENT_LIST in the study's index.html
then update DataPipe project n_conditions to match len(ASSIGNMENT_LIST)
"""
import random, json, sys

N_CONDITIONS   = int(sys.argv[1]) if len(sys.argv) > 1 else 4
N_PARTICIPANTS = int(sys.argv[2]) if len(sys.argv) > 2 else 500

assert N_PARTICIPANTS % N_CONDITIONS == 0, \
    f"N_PARTICIPANTS ({N_PARTICIPANTS}) must be divisible by N_CONDITIONS ({N_CONDITIONS})"

# block randomization — exact balance at every N_CONDITIONS slots
slots = []
for _ in range(N_PARTICIPANTS // N_CONDITIONS):
    block = list(range(N_CONDITIONS))
    random.shuffle(block)
    slots.extend(block)

print(json.dumps(slots))
