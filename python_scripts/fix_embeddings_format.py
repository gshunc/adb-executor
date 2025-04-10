import os

def fix_embeddings_format(input_filename="embeddings.jsonl", output_filename="embeddings_fixed.jsonl"):
    """Reads an input file containing lines of comma-separated numbers,
       wraps each line in square brackets to form valid JSON arrays,
       and writes the result to an output file.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.normpath(os.path.join(script_dir, "..", "server", "public", input_filename))
    output_path = os.path.normpath(os.path.join(script_dir, "..", "server", "public", output_filename))

    print(f"Reading from: {input_path}")
    print(f"Writing to:   {output_path}")

    lines_processed = 0
    lines_skipped = 0

    try:
        with open(input_path, 'r') as infile, open(output_path, 'w') as outfile:
            for line in infile:
                stripped_line = line.strip()
                if stripped_line:
                    # Check if it already looks like a JSON array
                    if stripped_line.startswith('[') and stripped_line.endswith(']'):
                        outfile.write(stripped_line + '\n') # Write as is
                    # Check if it looks like the invalid { [...] } format
                    elif stripped_line.startswith('{') and stripped_line.endswith('}'):
                         # Extract content within {} and assume it's a valid array string
                         content = stripped_line[1:-1].strip()
                         if content.startswith('[') and content.endswith(']'):
                             outfile.write(content + '\n')
                         else:
                             print(f"Warning: Skipping line with unexpected format inside {{}}: {stripped_line}")
                             lines_skipped += 1
                    # Assume it's the comma-separated format without brackets
                    else:
                         outfile.write(f'[{stripped_line}]\n')
                    lines_processed += 1
                else:
                     lines_skipped += 1 # Skip empty lines

        print(f"\nFinished processing.")
        print(f"Lines processed: {lines_processed}")
        print(f"Lines skipped (empty or unexpected format): {lines_skipped}")
        print(f"Corrected file saved as: {output_path}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    fix_embeddings_format()
