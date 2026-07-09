# Easy Codec JSON Config Builder

Local Streamlit tools used to create or enrich Easy Codec JSON configuration files from ROM config frames.

## What It Does

- `app.py` parses ROM config text or manual frames, suggests editable byte ranges, builds Easy Codec JSON, validates placeholders/localizations, and can transmit the result to a local Easy Codec checkout.
- `app2.py` compares product lists, finds products without the `EasyCodec` app flag, matches ROM config files, and opens `app.py` with the selected context.

The generated files target the Easy Codec structure:

```text
public/config/<product_file>.json
public/config/AvailableProductList.json
public/localisation/fr_FR.json
public/localisation/en_US.json
```

Those output paths are editable in `app.py` before transmission.

## Install

```bat
cd tools\json-config-builder
python -m pip install -r requirements.txt
```

## Run

Main builder:

```bat
python -m streamlit run app.py --server.port 8501
```

ROM config finder:

```bat
python -m streamlit run app2.py --server.port 8502
```

Or use:

```bat
Lanceroutil.bat
```

## Easy Codec Project Detection

The tool detects the target Easy Codec project in this order:

1. `EASY_CODEC_PROJECT_PATH` environment variable
2. `../Watteco-Easy-Codec`
3. `../Watteco-Easy-Codec-main`

The detected defaults are only suggestions: the JSON config folder, `AvailableProductList`, and localization files can be changed in the transmission form.

## Notes

- The builder links `type` and `visual_type` help buttons to the public configuration guide in this repository.
- The transmission step only writes local files. It does not commit or push changes.
- Generated caches and logs should not be committed.
