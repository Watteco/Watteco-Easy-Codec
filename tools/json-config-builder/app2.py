import csv
import csv
import io
import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import streamlit as st


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"


def first_existing_path(*paths):
    for path in paths:
        if path.exists():
            return path
    return paths[0]


DEFAULT_AVAILABLE_LIST = first_existing_path(DATA_DIR / "AvailableProductList.json", ROOT / "AvailableProductList.json")
DEFAULT_ROMCFG_LIST = first_existing_path(
    DATA_DIR / "AvailableProductsList.with_romcfg.json",
    ROOT / "AvailableProductsList.with_romcfg.json",
)
DEFAULT_ROM_DIR = first_existing_path(DATA_DIR / "blocks.unique", ROOT / "blocks.unique")
APP1_PORT = 8501


st.set_page_config(page_title="ROM Config Finder", layout="wide")


def read_text(path):
    data = Path(path).read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            pass
    return data.decode("utf-8", errors="replace")


def read_json(path):
    return json.loads(read_text(path))


def normalize_app_name(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


def has_easy_codec(product):
    return any(normalize_app_name(app) == "easycodec" for app in product.get("apps", []))


def display_value(value):
    if isinstance(value, list):
        return " / ".join(display_value(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return "" if value is None else str(value)


def product_code(product):
    text = " ".join(str(product.get(key, "")) for key in ("file", "name"))
    match = re.search(r"50-70-\d{3}", text)
    return match.group(0) if match else ""


def index_products(products):
    by_file = {}
    by_code = {}
    for product in products:
        file_key = str(product.get("file", "")).strip().lower()
        if file_key:
            by_file[file_key] = product
        code = product_code(product)
        if code and code not in by_code:
            by_code[code] = product
    return by_file, by_code


def find_rom_product(product, by_file, by_code):
    file_key = str(product.get("file", "")).strip().lower()
    if file_key in by_file:
        return by_file[file_key], "file"
    code = product_code(product)
    if code in by_code:
        return by_code[code], "code"
    return None, ""


def matching_rom_files_from_directory(product, rom_dir):
    code = product_code(product)
    if not code or not rom_dir.exists():
        return []
    return sorted(path.name for path in rom_dir.glob(f"*{code}*.txt"))


def build_rows(available_products, romcfg_products, rom_dir):
    by_file, by_code = index_products(romcfg_products)
    rows = []
    for product in available_products:
        if has_easy_codec(product):
            continue

        rom_product, match_type = find_rom_product(product, by_file, by_code)
        rom_entries = []
        if rom_product:
            rom_entries = rom_product.get("rom_default_cmds_filenames", []) or []

        if not rom_entries:
            rom_entries = [
                {"name": Path(file_name).stem, "file": file_name}
                for file_name in matching_rom_files_from_directory(product, rom_dir)
            ]
            if rom_entries:
                match_type = "directory"

        if rom_entries:
            for rom_entry in rom_entries:
                rom_file = rom_entry.get("file", "")
                rom_path = rom_dir / rom_file if rom_file else None
                rows.append({
                    "product_name": display_value(product.get("name", "")),
                    "product_file": display_value(product.get("file", "")),
                    "category": display_value(product.get("category", "")),
                    "apps": ", ".join(product.get("apps", [])),
                    "support_url": display_value(product.get("docLink", rom_product.get("docLink", "") if rom_product else "")),
                    "rom_name": display_value(rom_entry.get("name", "")),
                    "rom_file": display_value(rom_file),
                    "rom_path": str(rom_path) if rom_path else "",
                    "rom_exists": bool(rom_path and rom_path.exists()),
                    "match": match_type,
                })
        else:
            rows.append({
                "product_name": display_value(product.get("name", "")),
                "product_file": display_value(product.get("file", "")),
                "category": display_value(product.get("category", "")),
                "apps": ", ".join(product.get("apps", [])),
                "support_url": display_value(product.get("docLink", rom_product.get("docLink", "") if rom_product else "")),
                "rom_name": "",
                "rom_file": "",
                "rom_path": "",
                "rom_exists": False,
                "match": match_type or "none",
            })
    return rows


def rows_to_csv(rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "product_name",
        "product_file",
        "category",
        "apps",
        "support_url",
        "rom_name",
        "rom_file",
        "rom_path",
        "rom_exists",
        "match",
    ])
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def is_port_open(port, host="127.0.0.1", timeout=0.2):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def ensure_json_builder_running():
    if is_port_open(APP1_PORT):
        return True

    app_path = ROOT / "app.py"
    if not app_path.exists():
        return False

    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "streamlit",
            "run",
            str(app_path),
            "--server.port=8501",
            "--server.headless=true",
            "--browser.gatherUsageStats=false",
        ],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )

    for _ in range(20):
        if is_port_open(APP1_PORT):
            return True
        time.sleep(0.25)
    return is_port_open(APP1_PORT)


st.title("ROM Config Finder")
st.caption("Liste les produits sans EasyCodec et retrouve leurs ROM config associees.")

with st.sidebar:
    st.header("Sources")
    available_path = Path(st.text_input("AvailableProductList sans ROM", value=str(DEFAULT_AVAILABLE_LIST)))
    romcfg_path = Path(st.text_input("AvailableProductList avec ROM", value=str(DEFAULT_ROMCFG_LIST)))
    rom_dir = Path(st.text_input("Dossier ROM config", value=str(DEFAULT_ROM_DIR)))
    only_with_rom = st.checkbox("Afficher seulement les produits avec ROM", value=True)
    only_existing_roms = st.checkbox("Afficher seulement les fichiers ROM presents", value=False)

try:
    available_data = read_json(available_path)
    romcfg_data = read_json(romcfg_path)
except (OSError, json.JSONDecodeError) as exc:
    st.error(f"Impossible de charger les listes: {exc}")
    st.stop()

available_products = available_data.get("products", [])
romcfg_products = romcfg_data.get("products", [])
rows = build_rows(available_products, romcfg_products, rom_dir)
all_rows = rows

if only_existing_roms:
    rows = [row for row in rows if row["rom_exists"]]
if only_with_rom:
    rows = [row for row in rows if row["rom_file"]]

product_count = len({row["product_file"] for row in rows})
rom_count = len([row for row in rows if row["rom_file"]])
missing_file_count = len([row for row in rows if row["rom_file"] and not row["rom_exists"]])
without_easy_codec_count = len({row["product_file"] for row in all_rows})

c1, c2, c3, c4 = st.columns(4)
c1.metric("Produits affiches", product_count)
c2.metric("Lignes ROM", rom_count)
c3.metric("Fichiers ROM manquants", missing_file_count)
c4.metric("Sans EasyCodec", without_easy_codec_count)

if not rows:
    st.warning("Aucun resultat avec les filtres actuels. Decoche les filtres dans la barre de gauche.")

st.download_button(
    "Telecharger CSV",
    data=rows_to_csv(rows),
    file_name="produits_sans_easycodec_romcfg.csv",
    mime="text/csv",
)
st.download_button(
    "Telecharger JSON",
    data=json.dumps(rows, indent=4, ensure_ascii=False),
    file_name="produits_sans_easycodec_romcfg.json",
    mime="application/json",
)

st.dataframe(
    rows,
    width="stretch",
    hide_index=True,
    column_config={
        "rom_exists": st.column_config.CheckboxColumn("ROM existe"),
        "rom_path": st.column_config.TextColumn("Chemin ROM"),
        "support_url": st.column_config.LinkColumn("Support Watteco"),
    },
)

st.subheader("Contenu des ROM config")
rows_with_files = [row for row in rows if row["rom_file"]]
if not rows_with_files:
    st.info("Aucune ROM config associee dans le resultat actuel.")
else:
    labels = [
        f"{idx + 1}. {row['product_name']} - {row['rom_name'] or row['rom_file']}"
        for idx, row in enumerate(rows_with_files)
    ]
    selected_label = st.selectbox("ROM a ouvrir", labels)
    selected = rows_with_files[labels.index(selected_label)]
    selected_path = Path(selected["rom_path"])
    st.write(f"`{selected_path}`")
    app1_query = urlencode({
        "rom_path": str(selected_path),
        "product_file": selected["product_file"],
        "product_name": selected["product_name"],
        "category": selected["category"],
        "support_url": selected["support_url"],
    })
    if ensure_json_builder_running():
        st.link_button("Creer le JSON dans app.py", f"http://localhost:8501/?{app1_query}")
    else:
        st.error("Impossible de demarrer app.py sur http://localhost:8501.")
    if selected["support_url"]:
        st.link_button("Ouvrir la fiche support Watteco", selected["support_url"])
    if selected_path.exists():
        st.code(read_text(selected_path), language="text")
    else:
        st.warning("Le fichier est reference dans la liste, mais il n'existe pas dans le dossier ROM config.")
