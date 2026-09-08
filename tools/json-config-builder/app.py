import json
import importlib
from pathlib import Path

import streamlit as st

import easy_codec_builder.core as easy_core
easy_core = importlib.reload(easy_core)
from easy_codec_builder.core import *


APP_BUILD_ID = "anti-faux-produits-2026-07-02-1047"
APP_FRAME_PREFIX_BYTES = {"11", "21", "31", "41", "51", "61", "71", "81", "91"}
PUBLIC_README_URL = "https://github.com/Watteco/Watteco-Easy-Codec/tree/restore-valvo-config/public"
TYPE_HELP_URL = f"{PUBLIC_README_URL}#r%C3%A9f%C3%A9rence-rapide-types-ui-et-conversion"
VISUAL_HELP_URL = f"{PUBLIC_README_URL}#aper%C3%A7u-visuel-des-champs-ui"


def help_link(url, label="?"):
    st.markdown(f"[{label}]({url})")


def count_new_localization_keys(path, suggestions):
    try:
        existing_keys = set(read_json_file(Path(path)).keys())
    except (OSError, json.JSONDecodeError):
        existing_keys = set()
    return len([key for key in suggestions if key not in existing_keys])


def ui_accepts_frame(frame):
    bytes_list = frame.get("bytes", [])
    cmd_index = frame.get("cmd_index")
    if cmd_index == 0:
        return True
    if cmd_index == 1 and bytes_list and bytes_list[0] in APP_FRAME_PREFIX_BYTES:
        return True
    return False


def group_choices_from_existing_json(existing_json, section):
    section_data = (existing_json or {}).get(section, {})
    if not isinstance(section_data, dict):
        return []
    return [
        key
        for key, value in section_data.items()
        if key != "cfg_block" and isinstance(value, dict)
    ]


def first_section_with_groups(existing_json):
    for section in SECTION_CHOICES:
        if group_choices_from_existing_json(existing_json, section):
            return section
    return None


def existing_variable_options_from_json(existing_json):
    options = []
    if not isinstance(existing_json, dict):
        return options
    for section, section_data in existing_json.items():
        if not isinstance(section_data, dict):
            continue
        for group, group_data in section_data.items():
            if group == "cfg_block" or not isinstance(group_data, dict):
                continue
            fields = group_data.get("fields", {})
            if not isinstance(fields, dict):
                continue
            for field_name, field_data in fields.items():
                label = ""
                if isinstance(field_data, dict):
                    label = (field_data.get("HMI") or {}).get("label", "")
                options.append({
                    "section": section,
                    "group": group,
                    "name": field_name,
                    "label": label,
                })
    return options


def existing_variable_label(option):
    label = option.get("label") or ""
    label_suffix = f" - {label}" if label else ""
    return f"{option['section']} / {option['group']} / {option['name']}{label_suffix}"


def frame_context_defaults(existing_json, frame):
    default_frame_section = frame["section"]
    section = default_frame_section
    if existing_json and section not in existing_json:
        section = first_section_with_groups(existing_json) or section

    default_frame_group = default_group(frame, section)
    group_choices = group_choices_from_existing_json(existing_json, section)
    if default_frame_group in group_choices:
        group = default_frame_group
    elif group_choices:
        group = group_choices[0]
    else:
        group = default_frame_group

    group_data = ((existing_json or {}).get(section, {}) or {}).get(group, {})
    if not isinstance(group_data, dict):
        group_data = {}
    return {
        "section": section,
        "group": group,
        "group_label": group_data.get("label"),
        "default_state": group_data.get("default_state"),
        "group_choices": group_choices,
    }


st.set_page_config(page_title="Easy Codec JSON Builder", layout="wide")

st.title("Easy Codec JSON Builder")
st.caption("Analyse des trames ROM, choix manuel des valeurs modifiables, puis generation du JSON Easy Codec.")
st.caption(f"Version outil: {APP_BUILD_ID}")

linked_rom_path = query_param_value("rom_path")
linked_product_file = query_param_value("product_file")
linked_product_name = query_param_value("product_name")
linked_category = query_param_value("category")
linked_support_url = query_param_value("support_url")

with st.sidebar:
    st.header("Source")
    if linked_rom_path:
        st.success("ROM config recue depuis app2.")
        st.caption(linked_rom_path)
        if linked_support_url:
            st.link_button("Fiche support Watteco", linked_support_url)
        if st.button("Ignorer ce lien", key="clear_linked_rom"):
            st.query_params.clear()
            st.rerun()
    example_name = st.selectbox("Exemple local", list(EXAMPLE_FILES.keys()))
    uploaded_file = st.file_uploader("Ou charger un .txt", type=["txt"])
    uploaded_source_json = st.file_uploader(
        "Ou charger un JSON Easy Codec a ajouter",
        type=["json"],
        key="source_json_to_add",
        help="Utilise ce fichier comme contenu a fusionner, sans passer par un .txt ou des trames ROM.",
    )
    manual_frames_text = st.text_area(
        "Trames manuelles a ajouter",
        value="",
        height=140,
        help=(
            "Colle ici les trames absentes de la ROM config. "
            "Tu peux mettre une trame par ligne et ajouter des commentaires avec #."
        ),
    )
    st.divider()
    st.header("JSON existant")
    uploaded_existing_json = st.file_uploader(
        "JSON existant a comprendre/enrichir",
        type=["json"],
        key="maintenance_uploaded_existing_json",
        help=(
            "Charge ici le JSON de base. L'outil s'en sert pour pre-remplir "
            "la logique des nouvelles trames, puis pour la fusion."
        ),
    )
    st.divider()
    st.header("Options")
    show_decoder = st.checkbox("Afficher les liens Watteco", value=True)
    use_watteco_decoder = st.checkbox("Decoder les trames avec Watteco", value=True)
    add_fixed_frames = st.checkbox("Creer un champ customFrame pour les trames fixes", value=False)

source_text = ""
source_label = ""
source_json_data = None
source_json_name = None
existing_json_data = None
existing_config_name = None
existing_config_path = None
if uploaded_source_json is None:
    if linked_rom_path:
        source_path = Path(linked_rom_path)
        if source_path.exists():
            source_text = decode_text(source_path.read_bytes())
            source_label = str(source_path)
        else:
            st.error(f"Fichier ROM introuvable: {source_path}")
    elif uploaded_file is not None:
        source_text = decode_text(uploaded_file.read())
        source_label = uploaded_file.name
    elif EXAMPLE_FILES[example_name]:
        source_path = Path(EXAMPLE_FILES[example_name])
        if source_path.exists():
            source_text = decode_text(source_path.read_bytes())
            source_label = str(source_path)
        else:
            st.error(f"Fichier introuvable: {source_path}")

if uploaded_source_json is not None:
    try:
        source_json_data = json.loads(decode_text(uploaded_source_json.getvalue()))
        source_json_name = sanitize_config_file_name(uploaded_source_json.name)
    except json.JSONDecodeError as exc:
        st.error(f"Impossible de lire le JSON a ajouter: {exc}")
        st.stop()

if uploaded_existing_json is not None:
    try:
        existing_config_name = sanitize_config_file_name(uploaded_existing_json.name)
        existing_json_data = json.loads(decode_text(uploaded_existing_json.getvalue()))
    except json.JSONDecodeError as exc:
        st.error(f"Impossible de lire le JSON existant: {exc}")
        st.stop()

project_path = find_easy_codec_project()
config_files = []
if project_path is not None:
    config_dir = project_path / "public" / "config"
    config_files = sorted(
        path
        for path in config_dir.glob("*.json")
        if path.name.lower() != "availableproductlist.json"
    )

if existing_json_data is None and linked_product_file and config_files:
    linked_name = sanitize_config_file_name(linked_product_file)
    for path in config_files:
        if path.stem.lower() == linked_name.lower():
            try:
                existing_config_path = path
                existing_config_name = sanitize_config_file_name(path.stem)
                existing_json_data = read_json_file(path)
            except (OSError, json.JSONDecodeError) as exc:
                st.warning(f"Impossible de precharger le JSON existant `{path.name}`: {exc}")
            break

manual_frames_text = manual_frames_text.strip()
if not source_text and not manual_frames_text and source_json_data is None:
    st.info(
        "Charge un document, choisis un exemple local, colle des trames manuelles, "
        "ou charge un JSON Easy Codec a ajouter dans la barre laterale."
    )
    st.stop()

parsed_source_frames = parse_document(source_text) if source_text else []
for frame in parsed_source_frames:
    frame["source_origin"] = "ROM config"

manual_parsed_frames = parse_document(manual_frames_text) if manual_frames_text else []
for frame in manual_parsed_frames:
    frame["source_origin"] = "Saisie manuelle"
    frame["line_no"] = f"M{frame['line_no']}"

parsed_frames = [*parsed_source_frames, *manual_parsed_frames]
frames = [frame for frame in parsed_frames if ui_accepts_frame(frame)]
rejected_ui_frames = [frame for frame in parsed_frames if not ui_accepts_frame(frame)]
active_support_url = linked_support_url or find_support_url_for_context(
    linked_product_file,
    linked_product_name,
    source_label,
)
active_support_context = support_context_from_sources(
    active_support_url,
    linked_product_file,
    linked_product_name,
    linked_category,
    source_label,
)
support_context_key = f"support_context::{active_support_url}" if active_support_url else ""
if support_context_key and support_context_key in st.session_state:
    active_support_context = st.session_state[support_context_key]
document_label = source_json_name or source_label or "Saisie manuelle"
st.subheader(f"Document: {document_label}")
if source_json_data is not None:
    st.write("JSON Easy Codec charge directement.")
if frames:
    st.write(f"{len(frames)} trame(s) detectee(s).")
if manual_parsed_frames:
    accepted_manual_count = len([frame for frame in manual_parsed_frames if ui_accepts_frame(frame)])
    st.caption(f"{accepted_manual_count} trame(s) ajoutee(s) depuis la saisie manuelle.")
if rejected_ui_frames:
    with st.expander("Fragments ignores", expanded=False):
        for frame in rejected_ui_frames:
            st.code(" ".join(frame["bytes"]), language="text")

if active_support_url:
    with st.expander("Support Watteco associe", expanded=False):
        st.write(f"[Ouvrir la fiche support]({active_support_url})")
        if st.button("Analyser la fiche support", key="analyze_support_page"):
            try:
                support_html = fetch_support_page(active_support_url)
                support_text = html_to_text(support_html)
                support_links = extract_support_links(support_html, active_support_url)
                hints = support_hints_from_text(support_text)
                active_support_context = support_context_from_sources(
                    active_support_url,
                    linked_product_file,
                    linked_product_name,
                    linked_category,
                    source_label,
                    support_text,
                    support_links,
                )
                st.session_state[support_context_key] = active_support_context
            except requests.RequestException as exc:
                st.warning(f"Impossible de lire la fiche support: {exc}")
            else:
                if active_support_context.get("concepts"):
                    st.caption("Concepts detectes: " + ", ".join(sorted(active_support_context["concepts"])))
                if support_links:
                    st.write("Documents et pages utiles reperes:")
                    for item in support_links:
                        st.markdown(f"- [{item['label']}]({item['url']})")
                else:
                    st.info("Aucun lien de documentation n'a ete repere automatiquement sur la fiche.")
                if hints:
                    st.write("Elements reperes qui peuvent aider a choisir les champs modifiables:")
                    for hint in hints:
                        st.markdown(f"- {hint}")
                else:
                    st.info("Aucun indice clair trouve automatiquement. Ouvre la fiche support pour verifier manuellement.")

if not frames and source_json_data is None:
    st.warning("Aucune trame hexadecimal exploitable n'a ete detectee dans la source ou la saisie manuelle.")
    st.stop()

settings = {}
custom_localizations = {}
used_variable_defaults = {}
suggested_variable_names = {}
entered_variable_names = {}
existing_variable_options = existing_variable_options_from_json(existing_json_data)
for idx, frame in enumerate(frames):
    source_origin = frame.get("source_origin", "Source")
    exp_title = f"Trame {idx + 1} - {frame['detected_name']} - {source_origin} ligne {frame['line_no']}"
    preset = general_preset(frame)
    context_defaults = frame_context_defaults(existing_json_data, frame)
    watteco_decoded = None
    with st.expander(exp_title, expanded=idx < 3):
        include = st.checkbox("Inclure dans le JSON", value=True, key=f"include_{idx}")
        left, right = st.columns([2, 1])
        with left:
            st.code(" ".join(frame["bytes"]), language="text")
            index_line = " ".join(f"{i:02d}" for i in range(len(frame["bytes"])))
            st.text(f"Index : {index_line}")
            st.caption(frame["comment"])
            if frame["removed_length"]:
                st.caption(f"Octet de longueur retire: {frame['removed_length']}")
            if frame.get("report_params") is not None:
                rp = frame["report_params"]
                rp_flags = []
                rp_flags.append("batch" if frame.get("is_batch_report") else "standard")
                if frame.get("is_new_config"):
                    rp_flags.append("nouvelle configuration")
                st.caption(f"RP: 0x{rp:02X} ({', '.join(rp_flags)})")
            if frame.get("report_config") and frame["report_config"].get("criteria"):
                criteria_labels = []
                mode_labels = {0: "unused", 1: "delta", 2: "threshold", 3: "threshold+actions"}
                for criterion in frame["report_config"]["criteria"]:
                    flags = []
                    if criterion.get("alarm"):
                        flags.append("alarm")
                    if criterion.get("exceed"):
                        flags.append("up")
                    if criterion.get("fall"):
                        flags.append("down")
                    flag_text = f" ({', '.join(flags)})" if flags else ""
                    criteria_labels.append(f"slot {criterion['slot']}: {mode_labels.get(criterion['mode'], '?')}{flag_text}")
                st.caption("Criteres: " + " ; ".join(criteria_labels))
            if use_watteco_decoder:
                try:
                    watteco_decoded = easy_core.watteco_decode_frame(frame)
                    decoded_json = watteco_decoded.get("json") or {}
                except requests.RequestException as exc:
                    st.warning(f"Decodeur Watteco indisponible: {exc}")
                except (AttributeError, NameError) as exc:
                    st.warning(f"Decodeur Watteco non charge dans cette session: {exc}")
                else:
                    if decoded_json:
                        decoded_bits = [
                            decoded_json.get("CommandID", ""),
                            decoded_json.get("ClusterID", ""),
                            decoded_json.get("AttributeID", ""),
                        ]
                        st.caption("Watteco: " + " / ".join(bit for bit in decoded_bits if bit))
                    with st.expander("JSON decode Watteco", expanded=False):
                        st.code(watteco_decoded.get("text") or "Aucun decodage exploitable.", language="json")
        with right:
            if preset:
                st.info(f"Preset general_params: {preset['name']}")
                st.code(preset["frame"], language="text")
                st.caption(preset["comment"])
                section = st.selectbox(
                    "Section JSON",
                    SECTION_CHOICES,
                    index=SECTION_CHOICES.index("general_params"),
                    key=f"section_{idx}",
                )
                group = st.text_input(
                    "Groupe",
                    value=preset["group"] or "general_params",
                    key=f"group_{idx}",
                )
                group_label_fr, group_label_en_col = st.columns(2)
                with group_label_fr:
                    group_label_text = st.text_input(
                        "Label groupe FR",
                        value=display_text_from_ref("@customConfigLabel"),
                        key=f"group_label_{idx}",
                    )
                with group_label_en_col:
                    group_label_en = st.text_input(
                        "Label groupe EN",
                        value=display_en_from_ref("@customConfigLabel"),
                        key=f"group_label_en_{idx}",
                    )
                group_label = register_localized_ref(
                    group_label_text,
                    group_label_en,
                    "Label",
                    f"Group{idx + 1}",
                    custom_localizations,
                    "@customConfigLabel",
                )
                default_state = "true"
                comment_fr_col, comment_en_col = st.columns(2)
                with comment_fr_col:
                    comment_text = st.text_input(
                        "Commentaire cfg_block FR",
                        value=display_text_from_ref(preset["comment"]),
                        key=f"comment_label_{idx}",
                    )
                with comment_en_col:
                    comment_en = st.text_input(
                        "Commentaire cfg_block EN",
                        value=display_en_from_ref(preset["comment"]),
                        key=f"comment_label_en_{idx}",
                    )
                comment_label = register_localized_ref(
                    comment_text,
                    comment_en,
                    "cfgComment",
                    f"Frame{idx + 1}",
                    custom_localizations,
                    preset["comment"],
                )
                frame_field = ""
            else:
                if existing_json_data is not None:
                    st.caption("Defaults proposes depuis le JSON existant charge.")
                section = st.selectbox(
                    "Section JSON",
                    SECTION_CHOICES,
                    index=SECTION_CHOICES.index(context_defaults["section"]),
                    key=f"section_{idx}",
                )
                if section == context_defaults["section"]:
                    default_group_name = context_defaults["group"]
                else:
                    section_context = frame_context_defaults(existing_json_data, {**frame, "section": section})
                    default_group_name = section_context["group"]
                group = st.text_input("Groupe", value=default_group_name, key=f"group_{idx}")
                known_label = KNOWN_CLUSTERS.get(frame["cluster"], ("", "", "@generalLabel"))[2]
                default_group_label = context_defaults["group_label"] or known_label
                group_label_fr, group_label_en_col = st.columns(2)
                with group_label_fr:
                    group_label_text = st.text_input(
                        "Label groupe FR",
                        value=display_text_from_ref(default_group_label),
                        key=f"group_label_{idx}",
                    )
                with group_label_en_col:
                    group_label_en = st.text_input(
                        "Label groupe EN",
                        value=display_en_from_ref(default_group_label),
                        key=f"group_label_en_{idx}",
                    )
                group_label = register_localized_ref(
                    group_label_text,
                    group_label_en,
                    "Label",
                    f"Group{idx + 1}",
                    custom_localizations,
                    default_group_label,
                )
                default_state_value = context_defaults["default_state"]
                if default_state_value not in ("true", "false"):
                    default_state_value = "true"
                default_state = st.selectbox(
                    "Etat par defaut",
                    ["true", "false"],
                    index=["true", "false"].index(default_state_value),
                    key=f"default_state_{idx}",
                )
                default_comment_ref = default_cfg_comment(frame, section, group)
                comment_fr_col, comment_en_col = st.columns(2)
                with comment_fr_col:
                    comment_text = st.text_input(
                        "Commentaire cfg_block FR",
                        value=display_text_from_ref(default_comment_ref),
                        key=f"comment_label_{idx}",
                    )
                with comment_en_col:
                    comment_en = st.text_input(
                        "Commentaire cfg_block EN",
                        value=display_en_from_ref(default_comment_ref),
                        key=f"comment_label_en_{idx}",
                    )
                comment_label = register_localized_ref(
                    comment_text,
                    comment_en,
                    "cfgComment",
                    f"Frame{idx + 1}",
                    custom_localizations,
                    default_comment_ref,
                )
                frame_field = st.text_input(
                    "Nom customFrame si aucune variable",
                    value=f"frame_{idx + 1}",
                    key=f"frame_field_{idx}",
                    disabled=not add_fixed_frames,
                )
            if show_decoder:
                st.markdown(f"[Ouvrir dans le decodeur Watteco]({make_decoder_link(frame)})")

        if preset:
            settings[idx] = {
                "include": include,
                "section": section,
                "group": sanitize_name(group, f"group_{idx + 1}"),
                "group_label": group_label,
                "default_state": default_state,
                "comment_label": comment_label,
                "frame_field": "",
                "segments": [],
            }
            continue

        st.markdown("##### Valeurs modifiables")
        suggested = candidate_segments(frame)
        auto_suggestions = [
            suggestion
            for suggestion in suggested
            if str(suggestion[0]).startswith("xyz_")
        ]
        selected_suggestions = list(auto_suggestions)
        if suggested:
            with st.container(border=True):
                st.write("Suggestions")
                for s_idx, suggestion in enumerate(suggested):
                    base, label, start, end, f_type, visual = suggestion[:6]
                    second_start = suggestion[6] if len(suggestion) > 6 else None
                    second_end = suggestion[7] if len(suggestion) > 7 else None
                    display_label = suggestion_display_label(base, label)
                    segment_text = f"{' '.join(frame['bytes'][start:end + 1])}"
                    if second_start is not None and second_end is not None:
                        segment_text = f"{segment_text} / {' '.join(frame['bytes'][second_start:second_end + 1])}"
                    support_score, support_reason = support_match_for_suggestion(suggestion, active_support_context)
                    support_suffix = f" - support: {support_reason}" if support_score else ""
                    checked_by_default = True
                    suggestion_key = (
                        f"suggest_{idx}_{s_idx}_{base}"
                        if checked_by_default
                        else f"suggest_{idx}_{s_idx}"
                    )
                    checked = st.checkbox(
                        f"{display_label}: index {start} a {end} ({segment_text}){support_suffix}",
                        value=checked_by_default,
                        key=suggestion_key,
                    )
                    if checked and suggestion not in selected_suggestions:
                        selected_suggestions.append(suggestion)

        support_candidates = support_suspect_segments(frame, suggested, active_support_context)
        if support_candidates:
            with st.container(border=True):
                st.write("Candidats support a verifier")
                st.caption("Ces champs ne sont pas certains: ils sont proposes parce que la fiche support parle de periodes, seuils, alarmes ou mesures compatibles.")
                for c_idx, suggestion in enumerate(support_candidates):
                    base, label, start, end, f_type, visual = suggestion[:6]
                    display_label = suggestion_display_label(base, label)
                    segment_text = f"{' '.join(frame['bytes'][start:end + 1])}"
                    support_score, support_reason = support_match_for_suggestion(suggestion, active_support_context)
                    support_suffix = f" - support: {support_reason}" if support_score else ""
                    checked = st.checkbox(
                        f"{display_label}: index {start} a {end} ({segment_text}){support_suffix}",
                        value=False,
                        key=f"support_suggest_{idx}_{c_idx}",
                    )
                    if checked:
                        selected_suggestions.append(suggestion)

        default_count = st.session_state.get(f"manual_extra_count_{idx}", 0)
        manual_count = st.number_input(
            "Nombre de segments manuels supplementaires",
            min_value=0,
            max_value=12,
            value=int(default_count),
            key=f"manual_extra_count_{idx}",
        )
        byte_options = [f"{i:02d} - {b}" for i, b in enumerate(frame["bytes"])]
        segments = []
        segment_defaults = selected_suggestions + [
            (
                f"var_{idx + 1}_{seg_idx + 1}",
                "Valeur configurable",
                0,
                0,
                "hex1B",
                "numInput",
            )
            for seg_idx in range(int(manual_count))
        ]
        for seg_idx, defaults in enumerate(segment_defaults):
            base, label, start, end, f_type, visual = defaults[:6]
            second_start = defaults[6] if len(defaults) > 6 else None
            second_end = defaults[7] if len(defaults) > 7 else None
            with st.container(border=True):
                segment_title = suggestion_display_label(base, label)
                if not segment_title or segment_title == "Valeur configurable":
                    segment_title = f"Valeur configurable {seg_idx + 1}"
                st.write(segment_title)
                c1, c2, c3, c4 = st.columns([1, 1, 1, 1])
                with c1:
                    start_choice = st.selectbox("Debut", byte_options, index=start, key=f"seg_start_{idx}_{seg_idx}")
                with c2:
                    end_choice = st.selectbox("Fin", byte_options, index=end, key=f"seg_end_{idx}_{seg_idx}")
                start_idx = int(start_choice.split(" - ")[0])
                end_idx = int(end_choice.split(" - ")[0])
                if end_idx < start_idx:
                    st.warning("La fin doit etre superieure ou egale au debut.")
                    continue
                with c3:
                    type_select_col, type_help_col = st.columns([6, 1])
                    with type_select_col:
                        f_type_value = st.selectbox("Type", FIELD_TYPES, index=FIELD_TYPES.index(f_type), key=f"seg_type_{idx}_{seg_idx}")
                    with type_help_col:
                        help_link(TYPE_HELP_URL)
                with c4:
                    visual_select_col, visual_help_col = st.columns([6, 1])
                    with visual_select_col:
                        visual_value = st.selectbox("Visuel", VISUAL_TYPES, index=VISUAL_TYPES.index(visual), key=f"seg_visual_{idx}_{seg_idx}")
                    with visual_help_col:
                        help_link(VISUAL_HELP_URL)

                c5, c6, c7, c8 = st.columns([1.5, 1.5, 1, 1])
                current_variable_identity = variable_identity(section, group, base)
                if current_variable_identity[0] == "shared" and current_variable_identity in suggested_variable_names:
                    suggested_name = suggested_variable_names[current_variable_identity]
                else:
                    suggested_name = unique_variable_name(
                        default_variable_name(group, base, f"var_{idx + 1}_{seg_idx + 1}"),
                        used_variable_defaults,
                    )
                    suggested_variable_names[current_variable_identity] = suggested_name
                reuse_existing_variable = False
                variable_name = sanitize_name(
                    st.text_input("Nom variable", value=suggested_name, key=f"seg_name_{idx}_{seg_idx}"),
                    f"var_{idx + 1}_{seg_idx + 1}",
                )
                if existing_variable_options:
                    reuse_existing_variable = st.checkbox(
                        "Utiliser une variable existante",
                        value=False,
                        key=f"seg_reuse_existing_{idx}_{seg_idx}",
                    )
                    if reuse_existing_variable:
                        matching_index = next(
                            (
                                option_index
                                for option_index, option in enumerate(existing_variable_options)
                                if option["name"] == variable_name
                            ),
                            0,
                        )
                        selected_existing_variable = st.selectbox(
                            "Variable existante",
                            existing_variable_options,
                            index=matching_index,
                            format_func=existing_variable_label,
                            key=f"seg_existing_variable_{idx}_{seg_idx}",
                        )
                        variable_name = selected_existing_variable["name"]
                        st.caption(
                            "Cette variable sera utilisee dans la trame sans recreer le champ dans le JSON genere."
                        )
                previous_variable_identity = entered_variable_names.get(variable_name)
                if (
                    previous_variable_identity
                    and previous_variable_identity != current_variable_identity
                    and not reuse_existing_variable
                ):
                    st.warning(
                        f"Nom variable deja utilise: {variable_name}. Change-le sauf si les deux trames doivent vraiment piloter la meme variable."
                    )
                else:
                    entered_variable_names[variable_name] = current_variable_identity

                subgroup_name = st.text_input(
                    "Sous-groupe optionnel",
                    value="",
                    key=f"seg_subgroup_{idx}_{seg_idx}",
                    help="Laisse vide pour garder la variable dans le groupe principal.",
                )
                target_group = sanitize_name(group, f"group_{idx + 1}")
                target_group_label = group_label
                target_default_state = default_state
                if subgroup_name.strip():
                    subgroup_key = sanitize_name(subgroup_name, f"subgroup_{seg_idx + 1}")
                    target_group = sanitize_name(f"{target_group}_{subgroup_key}", f"group_{idx + 1}_{seg_idx + 1}")
                    subgroup_label_fr, subgroup_label_en_col = st.columns(2)
                    parent_label_fr = display_text_from_ref(group_label)
                    default_subgroup_label_fr = f"{parent_label_fr} - {subgroup_name.strip()}" if parent_label_fr else subgroup_name.strip()
                    with subgroup_label_fr:
                        subgroup_label_text = st.text_input(
                            "Label sous-groupe FR",
                            value=default_subgroup_label_fr,
                            key=f"seg_subgroup_label_{idx}_{seg_idx}",
                        )
                    with subgroup_label_en_col:
                        subgroup_label_en = st.text_input(
                            "Label sous-groupe EN",
                            value=auto_translate_to_en(default_subgroup_label_fr),
                            key=f"seg_subgroup_label_en_{idx}_{seg_idx}",
                        )
                    target_group_label = register_localized_ref(
                        subgroup_label_text,
                        subgroup_label_en,
                        "Label",
                        f"SubGroup{idx + 1}_{seg_idx + 1}",
                        custom_localizations,
                    )
                with c5:
                    default_value = st.text_input(
                        "Valeur par defaut",
                        value=segment_default_value_from_parts(
                            frame["bytes"],
                            start_idx,
                            end_idx,
                            f_type_value,
                            visual_value,
                            second_start,
                            second_end,
                        ),
                        key=f"seg_default_{idx}_{seg_idx}",
                    )
                with c6:
                    label_fr_col, label_en_col = st.columns(2)
                    with label_fr_col:
                        label_text = st.text_input(
                            "Label HMI FR",
                            value=display_text_from_ref(label),
                            key=f"seg_label_{idx}_{seg_idx}",
                        )
                    with label_en_col:
                        label_en = st.text_input(
                            "Label HMI EN",
                            value=display_en_from_ref(label),
                            key=f"seg_label_en_{idx}_{seg_idx}",
                        )
                    existing_label_ref = label if isinstance(label, str) and label.startswith("@") else None
                    label_value = register_localized_ref(
                        label_text,
                        label_en,
                        "Label",
                        f"Field{idx + 1}_{seg_idx + 1}",
                        custom_localizations,
                        existing_label_ref,
                    )
                default_min, default_max, default_step = segment_bounds_defaults(
                    f_type_value,
                    visual_value,
                    label if isinstance(label, str) and label.startswith("@") else label_value,
                    start_idx,
                    end_idx,
                    frame["cluster"],
                )
                with c7:
                    min_value = st.text_input("Min", value=default_min, key=f"seg_min_{idx}_{seg_idx}")
                with c8:
                    max_value = st.text_input("Max", value=default_max, key=f"seg_max_{idx}_{seg_idx}")
                step_value = st.text_input("Pas", value=default_step, key=f"seg_step_{idx}_{seg_idx}")
                dropdown_choices = []
                if visual_value == "dropdown":
                    choices_text = st.text_area(
                        "Choices dropdown",
                        value=default_dropdown_choices_text(default_value),
                        key=f"seg_choices_{idx}_{seg_idx}",
                        help="Une ligne par choix: valeur ou valeur: Label FR | Label EN",
                    )
                    dropdown_choices = parse_dropdown_choices(
                        choices_text,
                        custom_localizations,
                        f"{variable_name}Choice",
                    )
                    if not dropdown_choices and default_value:
                        dropdown_choices = [default_value]
                    choice_values = [choice[0] if isinstance(choice, list) else choice for choice in dropdown_choices]
                    if default_value and str(default_value) not in choice_values:
                        st.warning("La valeur par defaut n'est pas dans les choices du dropdown.")
                st.caption(f"Segment: {' '.join(frame['bytes'][start_idx:end_idx + 1])}")
                segments.append({
                    "name": variable_name,
                    "start": start_idx,
                    "end": end_idx,
                    "type": f_type_value,
                    "visual_type": visual_value,
                    "default_value": default_value,
                    "base": base,
                    "label": label_value,
                    "semantic_label": label if isinstance(label, str) and label.startswith("@") else label_value,
                    "min_value": min_value,
                    "max_value": max_value,
                    "step": step_value,
                    "choices": dropdown_choices,
                    "cluster": frame["cluster"],
                    "target_group": target_group,
                    "target_group_label": target_group_label,
                    "target_default_state": target_default_state,
                    "second_start": second_start,
                    "second_end": second_end,
                    "reuse_existing": reuse_existing_variable,
                })

        settings[idx] = {
            "include": include,
            "section": section,
            "group": sanitize_name(group, f"group_{idx + 1}"),
            "group_label": group_label,
            "default_state": default_state,
            "comment_label": comment_label,
            "frame_field": frame_field if add_fixed_frames else "",
            "segments": segments,
        }

json_data = source_json_data if source_json_data is not None else build_json(frames, settings)

final_json_data = json_data
merge_stats = None
maintenance_mode = False
overwrite_existing_fields = False

with st.expander("Maintenance d'un JSON existant", expanded=False):
    maintenance_mode = st.checkbox(
        "Enrichir un JSON existant au lieu de repartir de zero",
        value=bool(linked_product_file or existing_json_data),
        key="maintenance_mode",
    )
    if existing_config_name:
        st.caption(f"JSON charge depuis la sidebar: `{existing_config_name}.json`")
    selected_config = None
    if config_files:
        selected_index = 0
        if linked_product_file:
            linked_name = sanitize_config_file_name(linked_product_file)
            for file_index, path in enumerate(config_files):
                if path.stem.lower() == linked_name.lower():
                    selected_index = file_index
                    break
        selected_config = st.selectbox(
            "JSON existant",
            config_files,
            index=selected_index,
            format_func=lambda path: path.name,
            key="maintenance_existing_config",
            disabled=not maintenance_mode,
        )
    elif maintenance_mode and uploaded_existing_json is None:
        st.info("Aucun JSON local trouve. Charge un JSON existant pour l'enrichir.")

    overwrite_existing_fields = st.checkbox(
        "Remplacer les champs existants portant le meme nom",
        value=False,
        key="maintenance_overwrite_fields",
        disabled=not maintenance_mode,
    )
    if maintenance_mode:
        try:
            if existing_json_data is not None:
                pass
            elif selected_config is not None:
                existing_config_path = selected_config
                existing_config_name = sanitize_config_file_name(existing_config_path.stem)
                existing_json_data = read_json_file(existing_config_path)
            else:
                existing_json_data = None

            if existing_json_data is not None:
                final_json_data, merge_stats = merge_easy_codec_json(
                    existing_json_data,
                    json_data,
                    overwrite_existing_fields,
                )
        except (OSError, json.JSONDecodeError) as exc:
            st.error(f"Impossible de lire le JSON existant: {exc}")
            final_json_data = json_data
        else:
            if merge_stats is not None:
                if existing_config_path:
                    st.write(f"Base: `{existing_config_path}`")
                elif existing_config_name:
                    st.write(f"Base: `{existing_config_name}.json`")
                st.write(
                    "Fusion: "
                    f"{merge_stats['frames_added']} trame(s) ajoutee(s), "
                    f"{merge_stats['frames_skipped']} deja presente(s), "
                    f"{merge_stats['groups_added']} groupe(s) ajoute(s), "
                    f"{merge_stats['fields_added']} champ(s) ajoute(s), "
                    f"{merge_stats['fields_updated']} champ(s) remplace(s)."
                )

missing, unused = placeholder_validation(final_json_data)
missing_localizations = localization_validation(final_json_data)

st.divider()
st.subheader("JSON genere" if not maintenance_mode else "JSON fusionne")
if missing:
    st.error(f"Placeholders sans champ declare: {', '.join(missing)}")
if unused:
    st.warning(f"Champs declares mais non utilises: {', '.join(unused)}")
if missing_localizations:
    for lang, keys in missing_localizations.items():
        st.warning(f"Cles de localisation absentes en {lang}: {', '.join('@' + key for key in keys)}")
if missing_localizations or custom_localizations:
    suggestions = merge_localization_suggestions(missing_localizations, custom_localizations)
    with st.expander("Traductions a ajouter", expanded=True):
        st.markdown("FR")
        st.code(json.dumps(suggestions["fr_FR"], indent=4, ensure_ascii=False), language="json")
        st.markdown("EN")
        st.code(json.dumps(suggestions["en_US"], indent=4, ensure_ascii=False), language="json")

suggestions = merge_localization_suggestions(missing_localizations, custom_localizations)

json_text = json.dumps(final_json_data, indent=4, ensure_ascii=False)
st.code(json_text, language="json")
st.download_button(
    "Telecharger le JSON",
    data=json_text,
    file_name=f"{existing_config_name or source_json_name or 'easy_codec_config'}.json",
    mime="application/json",
)

st.divider()
st.subheader("Transmission Easy Codec")
if project_path is None:
    st.error("Projet Watteco-Easy-Codec introuvable. Verifie EASY_CODEC_PROJECT_CANDIDATES dans app.py.")
else:
    with st.form("easy_codec_transmit_form"):
        if existing_config_name:
            suggested_file_name = sanitize_config_file_name(existing_config_name)
        elif linked_product_file:
            suggested_file_name = sanitize_config_file_name(linked_product_file)
        elif source_json_name:
            suggested_file_name = sanitize_config_file_name(source_json_name)
        elif source_label:
            suggested_file_name = sanitize_config_file_name(Path(source_label).stem)
        else:
            suggested_file_name = "easy_codec_config"
        file_name = sanitize_config_file_name(st.text_input("Nom du fichier config", value=suggested_file_name))
        product_name = st.text_input("Nom dans AvailableProductList", value=linked_product_name or file_name)
        category = st.text_input("Categorie", value=linked_category or "zTest dev")
        comment_fr = st.text_input("Commentaire FR", value=product_name)
        comment_en = st.text_input("Commentaire US", value=auto_translate_to_en(comment_fr) if comment_fr else product_name)

        default_paths = default_easy_codec_paths(project_path)
        st.markdown("**Chemins de sortie**")
        config_dir_input = st.text_input(
            "Dossier JSON config",
            value=str(default_paths["config_dir"]),
            key="transmit_config_dir",
        )
        available_products_input = st.text_input(
            "AvailableProductList",
            value=str(default_paths["available_products_path"]),
            key="transmit_available_products_path",
        )
        fr_localization_input = st.text_input(
            "Localisation FR",
            value=str(default_paths["fr_localization_path"]),
            key="transmit_fr_localization_path",
        )
        en_localization_input = st.text_input(
            "Localisation US",
            value=str(default_paths["en_localization_path"]),
            key="transmit_en_localization_path",
        )

        config_dir = Path(config_dir_input)
        destination = config_dir / f"{file_name}.json"
        product_exists = False
        available_products_path = Path(available_products_input)
        fr_localization_path = Path(fr_localization_input)
        en_localization_path = Path(en_localization_input)
        try:
            available_products_preview = read_json_file(available_products_path)
            product_exists = any(product.get("file") == file_name for product in available_products_preview.get("products", []))
        except (OSError, json.JSONDecodeError):
            available_products_preview = {"products": []}

        st.write(f"JSON: {'modifier' if destination.exists() else 'creer'} `{destination}`")
        st.write(f"AvailableProductList: {'modifier' if product_exists else 'ajouter'} `{file_name}`")
        st.write(f"Localisation FR a ajouter: {count_new_localization_keys(fr_localization_path, suggestions.get('fr_FR', {}))}")
        st.write(f"Localisation US a ajouter: {count_new_localization_keys(en_localization_path, suggestions.get('en_US', {}))}")

        submitted = st.form_submit_button("Valider et transmettre a Easy Codec")

    if submitted:
        product_entry = {
            "name": product_name,
            "file": file_name,
            "apps": ["EasyCodec"],
            "category": category,
            "comment": [comment_en, comment_fr],
        }
        if active_support_url:
            product_entry["docLink"] = active_support_url
        output_paths = {
            "config_dir": config_dir,
            "destination": destination,
            "available_products_path": available_products_path,
            "fr_localization_path": fr_localization_path,
            "en_localization_path": en_localization_path,
        }
        try:
            result = transmit_to_easy_codec(project_path, final_json_data, suggestions, product_entry, output_paths)
            st.success("Transmission terminee. Recharge Easy Codec pour tester le capteur.")
            st.write(f"Fichier JSON: `{result['destination']}`")
            st.write(f"AvailableProductList: `{result['available_products_path']}`")
            st.write(f"Produit {result['product_action']} dans AvailableProductList: `{file_name}`")
            st.write(f"Cles FR ajoutees: {len(result['added_localizations']['fr_FR'])}")
            st.write(f"Cles US ajoutees: {len(result['added_localizations']['en_US'])}")
        except (OSError, json.JSONDecodeError) as exc:
            st.error(f"Transmission impossible: {exc}")
