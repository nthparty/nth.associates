import sys
import random
import json
import tqdm
import faker

def data_simulated(quantity, sample = None):
    if sample is None:
        sample = (quantity * 3) // 4

    fake = faker.Faker()

    # Create a database of records.
    rows = [
        [
            fake.name(),
            fake.email(),
            fake.ssn(),
            random.choice(['F', 'M']),
            str(random.choice(range(18, 90)))
        ]
        for _ in tqdm.tqdm(range(quantity), desc='Generating data')
    ]

    cols = list(zip(*rows))
    files = {}
    files['data-service.json'] = random.sample(list(zip(*[cols[1], cols[3], cols[4]])), sample)
    files['data-client.json'] = random.sample(list(zip(*cols[0:3])), sample)

    # Create the data files.
    for (path, data) in files.items():
        with open(path, 'w', newline='') as file:
            file.write(json.dumps(data, indent=2))

if __name__ == '__main__':
    data_simulated(
        int(sys.argv[1])\
        if len(sys.argv) == 2 else\
        100
    )
