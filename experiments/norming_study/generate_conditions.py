import random, json

# conditions map to subfolders: 0=slider, 1=waffle
N_CONDITIONS   = 4
N_PARTICIPANTS = 500   # set > target N; DataPipe n_conditions must match ASSIGNMENT_LIST.length

assert N_PARTICIPANTS % N_CONDITIONS == 0, "N_PARTICIPANTS must be divisible by N_CONDITIONS"

# block randomization — exact balance at every N_CONDITIONS slots
slots = []
for _ in range(N_PARTICIPANTS // N_CONDITIONS):
    block = list(range(N_CONDITIONS))
    random.shuffle(block)
    slots.extend(block)

print(json.dumps(slots))
# paste output into ASSIGNMENT_LIST in index.html
# then update DataPipe project n_conditions to match len(slots)
