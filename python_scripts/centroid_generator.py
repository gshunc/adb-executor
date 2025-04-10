import json
import os

def generate_centroid():

    script_dir = os.path.dirname(os.path.abspath(__file__))
    embeddings_filename = "embeddings_fixed.jsonl"
    embeddings_path = os.path.join(script_dir, "..", "server", "public", embeddings_filename)
    embeddings_path = os.path.normpath(embeddings_path)

    print("Trying to open:", embeddings_path)
    try:
        with open(embeddings_path, "r") as f:
            sum_vector = [0] * 1536
            count = 0
            for line in f:
                try:
                    embedding = json.loads(line.strip())
                    sum_vector = [sum_vector[i] + embedding[i] for i in range(1536)]
                    count += 1
                except json.JSONDecodeError as json_err:
                    print(f"Warning: Skipping invalid JSON line: {line.strip()}. Error: {json_err}")
                except Exception as e:
                    print(f"Warning: Skipping line due to unexpected error: {line.strip()}. Error: {e}")
            centroid = [x / count for x in sum_vector]
            print(f"Successfully generated centroid from {count} embeddings.")
            centroid_filename = "centroid.jsonl"
            centroid_path = os.path.join(script_dir, "..", "server", "public", centroid_filename)
            with open(centroid_path, "w") as centroid_file: 
                json.dump(centroid, centroid_file)
    except FileNotFoundError:
        print(f"Error: Embeddings file not found at the calculated path: {embeddings_path}")

if __name__ == "__main__":
    generate_centroid()