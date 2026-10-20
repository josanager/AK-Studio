"""One model instance, reused serially without changing its inference settings."""
import json
import os
import sys


def main():
    import torch
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    from audio_separator.separator import Separator
    separator = None
    for line in sys.stdin:
        try:
            item = json.loads(line)
            if separator is None:
                separator = Separator(
                    model_file_dir="/models", output_dir=item["output"], output_format="FLAC",
                    mdxc_params={"segment_size": 256, "override_model_segment_size": False,
                                 "batch_size": 1, "overlap": 2, "pitch_shift": 0})
                separator.load_model(model_filename=os.environ["SEPARATOR_MODEL"])
            separator.output_dir = item["output"]
            separator.model_instance.output_dir = item["output"]
            separator.separate(item["source"], custom_output_names={
                "Vocals": "lead", "Instrumental": "backing",
                "Lead Vocals": "lead", "Backing Vocals": "backing"})
            print("AK_RESULT:" + json.dumps({"ok": True}), flush=True)
        except Exception as error:
            print("AK_RESULT:" + json.dumps({"ok": False, "error": str(error)[:500]}), flush=True)


if __name__ == "__main__":
    main()
