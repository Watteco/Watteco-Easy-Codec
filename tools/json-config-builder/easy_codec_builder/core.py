import copy
import json
import os
import re
import struct
import unicodedata
from pathlib import Path
from urllib.parse import urlencode, urljoin

import requests
import streamlit as st
import urllib3

DECODER_URL = "https://lora.watteco.fr/Lora/Decoders/index.php"
ROOT = Path(__file__).resolve().parent.parent
EXAMPLE_FILES = {
    "Aucun": None,
}
EASY_CODEC_PROJECT_CANDIDATES = [
    Path(os.environ["EASY_CODEC_PROJECT_PATH"]),
] if os.environ.get("EASY_CODEC_PROJECT_PATH") else []
EASY_CODEC_PROJECT_CANDIDATES.extend([
    ROOT.parent / "Watteco-Easy-Codec",
    ROOT.parent / "Watteco-Easy-Codec-main",
])
SECTION_CHOICES = [
    "general_params",
    "batch_params",
    "standard_params",
    "configuration_params",
    "commande_params",
]
VISUAL_TYPES = [
    "timeSlider",
    "timeSliderHHMM",
    "doubleSlider",
    "slider",
    "numInput",
    "checkbox",
    "dropdown",
    "textInput",
    "customFrame",
]
FIELD_TYPES = [
    "timeVal",
    "hex1B",
    "hex2B",
    "hex3B",
    "hex4B",
    "bool",
    "float",
    "string",
    "frame",
]
COMMAND_BYTES = {"05", "06", "07", "09", "50"}
MAX_FRAME_BYTES = 40
FRAME_PREFIX_BYTES = {"11", "21", "31", "41", "51", "61", "71", "81", "91"}
KNOWN_CLUSTERS = {
    "000c": ("Analog value", "standard_A_params", "@analogLabel"),
    "0402": ("Temperature", "standard_T_params", "@tempLabel"),
    "0405": ("Humidity", "standard_H_params", "@humLabel"),
    "800c": ("CO2 / VOC", "standard_CO2_params", "@co2Label"),
    "0406": ("Presence", "standard_O_params", "@occupancyLabel"),
    "0400": ("Luminosity", "standard_I_params", "@illuminanceLabel"),
    "0403": ("Pressure", "standard_P_params", "@pressureLabel"),
    "0050": ("Action / configuration", "general_params", "@generalLabel"),
    "000f": ("Binary input", "standard_P_params", "@InputLabel"),
    "8004": ("Confirmed mode", "confirmed", "@confirmedLabel"),
    "800a": ("Electrical power", "standard_E_params", "@electricDataLabel"),
    "800b": ("Electrical data", "standard_E_params", "@electricDataLabel"),
    "800f": ("XYZ acceleration", "standard_XYZ_params", "@xyzAccelerationLabel"),
}
LOCALIZATION_SUGGESTIONS = {
    "analogLabel": ("Analog input", "Entrée analogique"),
    "pressureLabel": ("Pressure", "Pression"),
    "configurationLabel": ("Configuration", "Configuration"),
    "ActivationTime": ("Activation time", "Horaire d'activation"),
    "gapLabel": ("Gap", "Ecart"),
    "thresholdLabel": ("Threshold", "Seuil"),
    "delayLabel": ("Delay", "Delai"),
    "measureLabel": ("Measure period", "Periode mesure"),
    "emitMaxLabel": ("Max emission period", "Periode emission max"),
    "echantLabel": ("Sample period", "Periode echantillon"),
    "emitLabel": ("Emission period", "Periode emission"),
    "waitFreqLabel": ("Wait frequency", "Frequence attente"),
    "acqFreqLabel": ("Acquisition frequency", "Frequence acquisition"),
    "newWaitDelayLabel": ("New wait delay", "Delai nouvelle attente"),
    "maxAcqDurationLabel": ("Max acquisition duration", "Duree acquisition max"),
    "thresholdXLabel": ("Threshold X", "Seuil X"),
    "thresholdYLabel": ("Threshold Y", "Seuil Y"),
    "thresholdZLabel": ("Threshold Z", "Seuil Z"),
    "overThresholdDelayLabel": ("Over threshold delay", "Delai au-dessus seuil"),
    "underThresholdDelayLabel": ("Under threshold delay", "Delai sous seuil"),
    "rangeLabel": ("Range", "Plage"),
    "filterSmoothCoefLabel": ("Filter smooth coefficient", "Coefficient lissage filtre"),
    "filterGainCoefLabel": ("Filter gain coefficient", "Coefficient gain filtre"),
    "wakeModeLabel": ("Wake mode", "Mode reveil"),
    "vrmsLabel": ("Vrms", "Vrms"),
    "irmsLabel": ("Irms", "Irms"),
    "angleLabel": ("Angle", "Angle"),
    "tempLabel": ("Temperature", "Temperature"),
    "humLabel": ("Humidity", "Humidite"),
    "co2Label": ("CO2", "CO2"),
    "occupancyLabel": ("Presence", "Presence"),
    "illuminanceLabel": ("Light", "Luminosite"),
    "generalLabel": ("General", "General"),
    "electricDataLabel": ("Electrical data", "Donnees electriques"),
    "xyzAccelerationLabel": ("XYZ acceleration", "Acceleration XYZ"),
    "customConfigLabel": ("Custom config", "Configuration specifique"),
    "cfgCommentBatchTemp": ("Temperature batch", "Batch temperature"),
    "cfgCommentBatchHum": ("Humidity batch", "Batch humidite"),
    "cfgCommentBatchCO2": ("CO2 batch", "Batch CO2"),
    "cfgCommentBatchOccupancy": ("Presence batch", "Batch presence"),
    "cfgCommentBatchIlluminance": ("Light batch", "Batch luminosite"),
    "cfgCommentBatchBatt": ("Battery batch", "Batch batterie"),
    "cfgCommentBatchAnalog": ("Analog batch", "Batch analogique"),
    "cfgCommentBatchPressure": ("Pressure batch", "Batch pression"),
    "cfgCommentBatchElectricData": ("Electrical data batch", "Batch donnees electriques"),
    "cfgCommentStandTemp": ("Temperature report", "Releve temperature"),
    "cfgCommentStandHum": ("Humidity report", "Releve humidite"),
    "cfgCommentStandCO2": ("CO2 report", "Releve CO2"),
    "cfgCommentStandOccupancy": ("Presence report", "Releve presence"),
    "cfgCommentStandIlluminance": ("Light report", "Releve luminosite"),
    "cfgCommentStandState": ("State report", "Releve etat"),
    "cfgCommentStandAnalog": ("Analog report", "Releve analogique"),
    "cfgCommentStandPressure": ("Pressure report", "Releve pression"),
    "cfgCommentStandElectricData": ("Electrical data report", "Releve donnees electriques"),
    "cfgCommentGeneralAction": ("General action", "Action generale"),
    "cfgCommentConfigFrame": ("Configuration", "Configuration"),
    "cfgCommentCommandFrame": ("Command", "Commande"),
    "cfgCommentCustomFrame": ("Custom frame", "Trame specifique"),
    "cfgCommentstandard_A_params": ("Analog report", "Releve analogique"),
    "cfgCommentstandard_T_params": ("Temperature report", "Releve temperature"),
    "cfgCommentstandard_H_params": ("Humidity report", "Releve humidite"),
    "cfgCommentstandard_CO2_params": ("CO2 report", "Releve CO2"),
    "cfgCommentstandard_O_params": ("Presence report", "Releve presence"),
    "cfgCommentstandard_I_params": ("Light report", "Releve luminosite"),
    "cfgCommentstandard_P_params": ("Pressure report", "Releve pression"),
    "cfgCommentstandard_E_params": ("Electrical data report", "Releve donnees electriques"),
    "cfgCommentbatch_A_params": ("Analog batch", "Batch analogique"),
    "cfgCommentbatch_T_params": ("Temperature batch", "Batch temperature"),
    "cfgCommentbatch_H_params": ("Humidity batch", "Batch humidite"),
    "cfgCommentbatch_CO2_params": ("CO2 batch", "Batch CO2"),
    "cfgCommentbatch_O_params": ("Presence batch", "Batch presence"),
    "cfgCommentbatch_I_params": ("Light batch", "Batch luminosite"),
    "cfgCommentbatch_P_params": ("Pressure batch", "Batch pression"),
    "cfgCommentbatch_E_params": ("Electrical data batch", "Batch donnees electriques"),
    "cfgCommentRemoveConfig": ("Reset config", "RAZ configuration"),
    "cfgCommentPullOut": ("Sensor removal", "Retrait capteur"),
    "cfgCommentConfirmed": ("Confirmed mode", "Mode confirme"),
    "cfgCommentRemoveHeader": ("Remove header", "Retrait entete"),
    "cfgCommentCTNConfiguration": ("CTN config", "Configuration CTN"),
}
THRESHOLD_BOUNDS_BY_CLUSTER = {
    "000c": ("0", "30", "0.1"),
    "0402": ("1", "55", "1"),
    "0405": ("1", "100", "1"),
    "800c": ("100", "5000", "1"),
    "0400": ("0", "100000", "1"),
    "0403": ("300", "1100", "1"),
    "0050": ("2000", "3700", "1"),
    "000f": ("0", "1", "1"),
    "800f": ("0", "10000", "1"),
}
THRESHOLD_HMI_BY_CLUSTER = {
    "000c": {"unit": "A"},
    "0402": {"unit": "°C", "multiplier": "100"},
    "0405": {"unit": "%", "multiplier": "100"},
    "800c": {"unit": "ppm"},
    "0400": {"unit": "lx"},
    "0403": {"unit": "hPa"},
    "0050": {"unit": "mV"},
    "800f": {"unit": "cG"},
}
XYZ_ACCELERATION_PARAMS = [
    ("xyz_wait_freq", "@waitFreqLabel", 0, 1, "hex2B", "numInput"),
    ("xyz_acq_freq", "@acqFreqLabel", 2, 3, "hex2B", "numInput"),
    ("xyz_new_wait_delay", "@newWaitDelayLabel", 4, 5, "hex2B", "numInput"),
    ("xyz_max_acq_duration", "@maxAcqDurationLabel", 6, 7, "hex2B", "numInput"),
    ("xyz_threshold_x", "@thresholdXLabel", 8, 9, "hex2B", "slider"),
    ("xyz_threshold_y", "@thresholdYLabel", 10, 11, "hex2B", "slider"),
    ("xyz_threshold_z", "@thresholdZLabel", 12, 13, "hex2B", "slider"),
    ("xyz_over_threshold_delay", "@overThresholdDelayLabel", 14, 15, "hex2B", "numInput"),
    ("xyz_under_threshold_delay", "@underThresholdDelayLabel", 16, 17, "hex2B", "numInput"),
    ("xyz_range", "@rangeLabel", 18, 19, "hex2B", "numInput"),
    ("xyz_filter_smooth_coef", "@filterSmoothCoefLabel", 20, 20, "hex1B", "numInput"),
    ("xyz_filter_gain_coef", "@filterGainCoefLabel", 21, 21, "hex1B", "numInput"),
    ("xyz_wake_mode", "@wakeModeLabel", 22, 22, "hex1B", "numInput"),
]
CLUSTER_COMMENTS = {
    "batch_params": {
        "000c": "@cfgCommentBatchAnalog",
        "0402": "@cfgCommentBatchTemp",
        "0405": "@cfgCommentBatchHum",
        "800c": "@cfgCommentBatchCO2",
        "0406": "@cfgCommentBatchOccupancy",
        "0400": "@cfgCommentBatchIlluminance",
        "0403": "@cfgCommentBatchPressure",
        "0050": "@cfgCommentBatchBatt",
        "800a": "@cfgCommentBatchElectricData",
        "800b": "@cfgCommentBatchElectricData",
    },
    "standard_params": {
        "000c": "@cfgCommentStandAnalog",
        "0402": "@cfgCommentStandTemp",
        "0405": "@cfgCommentStandHum",
        "800c": "@cfgCommentStandCO2",
        "0406": "@cfgCommentStandOccupancy",
        "0400": "@cfgCommentStandIlluminance",
        "0403": "@cfgCommentStandPressure",
        "000f": "@cfgCommentStandState",
        "800a": "@cfgCommentStandElectricData",
        "800b": "@cfgCommentStandElectricData",
    },
    "general_params": {
        "0050": "@cfgCommentGeneralAction",
    },
}
IGNORE_HEX_WORDS = {"de", "ce", "ca", "face", "decade"}
PRODUCT_REFERENCE_RE = re.compile(
    r"^(?:36|50|71|99)[-_ ]70[-_ ][0-9A-Fa-f]{3}[-_ ][0-9A-Fa-f]{3}$"
)


def decode_text(data):
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            pass
    return data.decode("utf-8", errors="replace")


def split_hex_token(token):
    token = token.strip(",;:()[]{}<>\"'")
    if PRODUCT_REFERENCE_RE.fullmatch(token):
        return []
    token = re.sub(r"^(?:[A-Za-z_][\w-]*[:=])+", "", token)
    token = re.sub(r"^0x", "", token, flags=re.IGNORECASE)
    token = token.replace("-", "").replace("_", "").replace(":", "")
    if re.fullmatch(r"(?:36|50|71|99)70[0-9a-fA-F]{6}", token):
        return []
    if token.lower() in IGNORE_HEX_WORDS:
        return []
    if not re.fullmatch(r"[0-9a-fA-F]+", token):
        return []
    if len(token) == 2:
        return [token.upper()]
    if len(token) >= 4 and len(token) % 2 == 0:
        return [token[i:i + 2].upper() for i in range(0, len(token), 2)]
    return []


def remove_square_bracketed_text(line):
    return re.sub(r"\[[^\]]*\]", " ", line)


def extract_hex_sequences(line):
    line = remove_square_bracketed_text(line)
    sequences = []
    current = []
    for token in re.split(r"[\s,;()\[\]{}<>\"']+", line):
        if not token:
            continue
        if re.fullmatch(r"[-_:]+", token):
            continue
        if re.fullmatch(r"\([A-Za-z_][A-Za-z0-9_]*\)", token):
            continue
        chunks = split_hex_token(token)
        if chunks:
            current.extend(chunks)
            continue
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", token):
            continue
        if len(current) >= 2:
            sequences.append(current)
        current = []
    if len(current) >= 2:
        sequences.append(current)
    return sequences


def looks_like_frame_start(bytes_list, idx, allow_bare_command=True):
    if idx >= len(bytes_list):
        return False
    if allow_bare_command and bytes_list[idx] in COMMAND_BYTES:
        return True
    return (
        bytes_list[idx] in FRAME_PREFIX_BYTES
        and idx + 1 < len(bytes_list)
        and bytes_list[idx + 1] in COMMAND_BYTES
    )


def looks_like_length_prefixed_frame(bytes_list, idx):
    if idx + 2 >= len(bytes_list):
        return False
    payload_len = int(bytes_list[idx], 16)
    frame_size = payload_len + 1
    if payload_len < 2 or payload_len > MAX_FRAME_BYTES or idx + frame_size > len(bytes_list):
        return False
    end_idx = idx + frame_size
    if not looks_like_frame_start(bytes_list, idx + 1, allow_bare_command=False):
        return False
    return (
        end_idx == len(bytes_list)
        or looks_like_frame_start(bytes_list, end_idx, allow_bare_command=False)
        or looks_like_length_prefixed_frame(bytes_list, end_idx)
    )


def split_sequence_into_frames(bytes_list):
    frames = []
    idx = 0
    while idx < len(bytes_list):
        remaining = len(bytes_list) - idx
        if looks_like_length_prefixed_frame(bytes_list, idx):
            frame_size = int(bytes_list[idx], 16) + 1
            frames.append(bytes_list[idx:idx + frame_size])
            idx += frame_size
            continue

        if (
            bytes_list[idx] == "05"
            or (
                bytes_list[idx] in FRAME_PREFIX_BYTES
                and idx + 1 < len(bytes_list)
                and bytes_list[idx + 1] == "05"
            )
        ):
            take = min(MAX_FRAME_BYTES, remaining)
            frames.append(bytes_list[idx:idx + take])
            idx += take
            continue

        next_start = None
        search_from = idx + 1 if looks_like_frame_start(bytes_list, idx) else idx + 1
        for candidate in range(search_from, len(bytes_list)):
            if looks_like_length_prefixed_frame(bytes_list, candidate) or looks_like_frame_start(bytes_list, candidate, allow_bare_command=False):
                next_start = candidate
                break

        if next_start is None:
            take = min(MAX_FRAME_BYTES, remaining)
        else:
            take = min(MAX_FRAME_BYTES, next_start - idx)
        if take < 2 and next_start is not None:
            idx = next_start
            continue
        frames.append(bytes_list[idx:idx + take])
        idx += take
    return frames


def strip_length_byte(bytes_list):
    if len(bytes_list) >= 2:
        first = int(bytes_list[0], 16)
        if first == len(bytes_list) - 1 and looks_like_frame_start(bytes_list, 1, allow_bare_command=False):
            return bytes_list[1:], bytes_list[0]
    return bytes_list, None


def is_plausible_frame_context(bytes_list, context):
    cmd_index = context.get("cmd_index", 0)
    if cmd_index == 0:
        return bytes_list[0] in COMMAND_BYTES
    if cmd_index == 1:
        return bytes_list[0] in FRAME_PREFIX_BYTES and bytes_list[1] in COMMAND_BYTES
    return False


def compact_hex(bytes_list):
    return "".join(bytes_list).lower()


def report_params_byte(frame):
    start = frame.get("cluster_start")
    if start is None or start + 2 >= len(frame["bytes"]):
        return None
    try:
        return int(frame["bytes"][start + 2], 16)
    except ValueError:
        return None


def is_batch_report_params(rp):
    return rp is not None and bool(rp & 0x01)


def is_new_report_params(rp):
    return rp is not None and bool(rp & 0x80)


def report_value_size(attr_type):
    sizes = {
        "08": 1, "10": 1, "18": 1, "20": 1, "28": 1, "30": 1,
        "09": 2, "19": 2, "21": 2, "29": 2, "31": 2,
        "0a": 3, "1a": 3, "22": 3, "2a": 3,
        "0b": 4, "1b": 4, "23": 4, "2b": 4, "39": 4,
        "0c": 5, "1c": 5, "24": 5, "2c": 5,
        "0d": 6, "1d": 6, "25": 6, "2d": 6,
        "0e": 7, "1e": 7, "26": 7, "2e": 7,
        "0f": 8, "1f": 8, "27": 8, "2f": 8,
    }
    return sizes.get(attr_type.lower())


def report_type_has_field_index(attr_type):
    return attr_type.lower() in {"41", "42", "43", "4c"}


def parse_report_configuration(frame):
    if frame.get("cmd") != "06" or frame.get("cluster_start") is None:
        return None
    bytes_list = frame["bytes"]
    start = frame["cluster_start"]
    if start + 9 >= len(bytes_list):
        return None

    rp = report_params_byte(frame)
    attr_type = bytes_list[start + 5]
    value_size = report_value_size(attr_type)
    if value_size is None:
        return None

    parsed = {
        "rp": rp,
        "new_mode": is_new_report_params(rp),
        "batch": is_batch_report_params(rp),
        "attr_type": attr_type,
        "min_interval": (start + 6, start + 7),
        "max_interval": (start + 8, start + 9),
        "criteria": [],
    }

    if not parsed["new_mode"] or parsed["batch"]:
        return parsed

    cursor = start + 10
    if report_type_has_field_index(attr_type) and cursor < len(bytes_list):
        parsed["size"] = cursor
        cursor += 1
    if rp is not None and (rp & 0x02) and cursor < len(bytes_list):
        parsed["port"] = cursor
        cursor += 1

    while cursor < len(bytes_list):
        csd_idx = cursor
        csd = int(bytes_list[cursor], 16)
        cursor += 1
        mode = (csd >> 3) & 0x03
        criterion = {
            "csd_index": csd_idx,
            "csd": csd,
            "slot": csd & 0x07,
            "mode": mode,
            "fall": bool(csd & 0x20),
            "exceed": bool(csd & 0x40),
            "alarm": bool(csd & 0x80),
        }
        if mode == 0:
            parsed["criteria"].append(criterion)
            continue
        if report_type_has_field_index(attr_type) and cursor < len(bytes_list):
            criterion["field_index"] = cursor
            cursor += 1
        if cursor + value_size > len(bytes_list):
            break
        criterion["value"] = (cursor, cursor + value_size - 1)
        cursor += value_size
        if mode in (2, 3):
            if cursor + value_size > len(bytes_list):
                break
            criterion["gap"] = (cursor, cursor + value_size - 1)
            cursor += value_size
            if cursor >= len(bytes_list):
                break
            criterion["occ"] = cursor
            occ = int(bytes_list[cursor], 16)
            cursor += 1
            if occ & 0x80 and cursor + 4 <= len(bytes_list):
                criterion["occ_high"] = (cursor, cursor + 1)
                criterion["occ_low"] = (cursor + 2, cursor + 3)
                cursor += 4
            if mode == 3 and cursor < len(bytes_list):
                criterion["actions_start"] = cursor
                action_desc = int(bytes_list[cursor], 16)
                cursor += 1 + (action_desc & 0x7F)
        parsed["criteria"].append(criterion)
    return parsed


def find_command_context(bytes_list):
    best = None
    best_command = None
    joined = compact_hex(bytes_list)
    for idx, byte in enumerate(bytes_list):
        if byte not in COMMAND_BYTES:
            continue
        if best_command is None:
            best_command = idx
        max_cluster_start = min(len(bytes_list) - 2, idx + 6)
        for cluster_start in range(idx + 1, max_cluster_start + 1):
            cluster = (bytes_list[cluster_start] + bytes_list[cluster_start + 1]).lower()
            if cluster not in KNOWN_CLUSTERS:
                continue
            score = 100 - (cluster_start - idx) * 10
            if idx in (0, 1):
                score += 8
            if byte == "06" and cluster != "0050":
                score += 8
            if best is None or score > best["score"]:
                best = {
                    "cmd_index": idx,
                    "cluster": cluster,
                    "cluster_start": cluster_start,
                    "score": score,
                }
    if best:
        return best
    if best_command is not None:
        cluster_start = best_command + 1 if best_command + 2 < len(bytes_list) else None
        cluster = "0000"
        if cluster_start is not None:
            cluster = (bytes_list[cluster_start] + bytes_list[cluster_start + 1]).lower()
        return {
            "cmd_index": best_command,
            "cluster": cluster,
            "cluster_start": cluster_start,
            "score": 1,
        }
    for cluster in KNOWN_CLUSTERS:
        pos = joined.find(cluster)
        if pos >= 0 and pos % 2 == 0:
            return {
                "cmd_index": 0,
                "cluster": cluster,
                "cluster_start": pos // 2,
                "score": 1,
            }
    return {"cmd_index": 0, "cluster": "0000", "cluster_start": None, "score": 0}


def default_section(frame):
    raw = compact_hex(frame["bytes"])
    cmd = frame["cmd"]
    cluster = frame["cluster"]
    if cmd == "50" or cluster == "0050" and "500203" in raw:
        return "general_params"
    if cmd == "05" and cluster == "0050":
        action_match = re.search(r"0050ff([0-9a-f]{2})", raw)
        if action_match and int(action_match.group(1), 16) >= 8:
            return "configuration_params"
        return "general_params"
    if cmd == "05" and cluster == "800f":
        return "configuration_params"
    if cmd == "06":
        rp = report_params_byte(frame)
        if is_batch_report_params(rp):
            return "batch_params"
        return "standard_params"
    return "general_params"


def default_group(frame, section):
    cluster = frame["cluster"]
    if section == "configuration_params" and cluster == "800f":
        return "configuration_XYZ_params"
    if section == "batch_params" and cluster in KNOWN_CLUSTERS:
        return KNOWN_CLUSTERS[cluster][1].replace("standard_", "batch_")
    if cluster in KNOWN_CLUSTERS:
        return KNOWN_CLUSTERS[cluster][1]
    if section == "configuration_params":
        return "configuration_frames"
    if section == "commande_params":
        return "command_frames"
    return "custom_config"


def compact_source_comment(comment):
    if not comment or comment == "Trame detectee":
        return ""
    candidates = [part.strip() for part in comment.split(" - ") if part.strip()]
    noise = (
        "rp",
        "csd",
        "occ",
        "note:",
        "notice",
        "periodic max",
        "following configurations",
        "configuration frames",
    )
    for candidate in reversed(candidates):
        cleaned = re.sub(r"\([^)]{35,}\)", "", candidate)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .:-")
        if not cleaned or cleaned.lower().startswith(noise):
            continue
        cleaned = re.sub(r"\s*=>\s*", " ", cleaned)
        cleaned = re.sub(r"\b0x([0-9a-fA-F]+)\b", r"x\1", cleaned)
        if len(cleaned) > 55:
            cleaned = re.split(r"[.;]", cleaned, maxsplit=1)[0].strip()
        if 4 <= len(cleaned) <= 55:
            return cleaned
    return ""


CLUSTER_COMMENT_TOKENS = {
    "000c": "Analog",
    "0402": "Temp",
    "0405": "Hum",
    "800c": "CO2",
    "0406": "Occupancy",
    "0400": "Illuminance",
    "0403": "Pressure",
    "0050": "Battery",
    "000f": "State",
    "800a": "ElectricPower",
    "800b": "ElectricData",
}


def analytic_cfg_comment(frame, section):
    token = CLUSTER_COMMENT_TOKENS.get(frame["cluster"], "Frame")
    report_config = frame.get("report_config")
    if frame["cmd"] == "06":
        if section == "batch_params":
            return f"@cfgCommentBatch{token}Period"
        criteria = report_config.get("criteria", []) if report_config else []
        modes = {criterion.get("mode") for criterion in criteria}
        has_action = any("actions_start" in criterion for criterion in criteria)
        if has_action:
            return f"@cfgCommentStand{token}Action"
        if 2 in modes or 3 in modes:
            flags = {flag for criterion in criteria for flag in ("exceed", "fall") if criterion.get(flag)}
            if flags == {"exceed"}:
                return f"@cfgCommentStand{token}ThresholdHigh"
            if flags == {"fall"}:
                return f"@cfgCommentStand{token}ThresholdLow"
            return f"@cfgCommentStand{token}Threshold"
        if 1 in modes:
            return f"@cfgCommentStand{token}Delta"
        return f"@cfgCommentStand{token}Period"
    if frame["cmd"] == "05":
        raw = compact_hex(frame["bytes"])
        if "ff06" in raw:
            return "@cfgCommentActivationTime"
        return f"@cfgCommentConfig{token}"
    fallback_by_section = {
        "configuration_params": "@cfgCommentConfigFrame",
        "commande_params": "@cfgCommentCommandFrame",
        "general_params": "@cfgCommentGeneralAction",
    }
    return fallback_by_section.get(section, "@cfgCommentCustomFrame")


def default_cfg_comment(frame, section, group):
    preset = general_preset(frame)
    if preset:
        return preset["comment"]
    source_comment = compact_source_comment(frame.get("comment"))
    if source_comment:
        fallback = f"Frame{frame['line_no']}"
        return f"@cfgComment{sanitize_name(source_comment, fallback)}"
    return analytic_cfg_comment(frame, section)


def parse_document(text):
    frames = []
    comment_parts = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#") or stripped.startswith("."):
            comment = stripped.lstrip("#.").strip()
            comment_sequences = extract_hex_sequences(comment)
            has_commented_frame = bool(
                comment_sequences
                and (
                    looks_like_length_prefixed_frame(comment_sequences[0], 0)
                    or looks_like_frame_start(comment_sequences[0], 0)
                )
            )
            if has_commented_frame:
                stripped = comment
            elif comment:
                comment_parts.append(comment)
                continue
            else:
                continue
        if stripped.startswith("[") or stripped.startswith("@"):
            continue

        sequences = extract_hex_sequences(stripped)
        if not sequences:
            if not re.fullmatch(r"[0-9a-fA-F ]+", stripped):
                comment_parts.append(stripped)
            continue

        frame_sequences = []
        for bytes_list in sequences:
            frame_sequences.extend(split_sequence_into_frames(bytes_list))

        for sequence_index, bytes_list in enumerate(frame_sequences, start=1):
            bytes_list, removed_length = strip_length_byte(bytes_list)
            if len(bytes_list) < 2:
                continue
            context = find_command_context(bytes_list)
            if not is_plausible_frame_context(bytes_list, context):
                continue
            cmd_index = context["cmd_index"]
            cmd = bytes_list[cmd_index] if cmd_index < len(bytes_list) else "00"
            cluster = context["cluster"]
            detected_name = KNOWN_CLUSTERS.get(cluster, ("Trame brute", "", ""))[0]
            comment = " - ".join(comment_parts[-3:]) or "Trame detectee"
            if len(frame_sequences) > 1:
                comment = f"{comment} ({sequence_index}/{len(frame_sequences)} sur la ligne)"
            frame = {
                "line_no": line_no,
                "source_line": stripped,
                "comment": comment,
                "bytes": bytes_list,
                "removed_length": removed_length,
                "cmd": cmd,
                "cmd_index": cmd_index,
                "cluster": cluster,
                "cluster_start": context["cluster_start"],
                "detected_name": detected_name,
            }
            rp = report_params_byte(frame)
            frame["report_params"] = rp
            frame["is_new_config"] = is_new_report_params(rp)
            frame["is_batch_report"] = is_batch_report_params(rp)
            frame["section"] = default_section(frame)
            frame["group"] = default_group(frame, frame["section"])
            frame["report_config"] = parse_report_configuration(frame)
            frames.append(frame)
        comment_parts = []
    return frames


def candidate_segments(frame):
    segments = []
    bytes_list = frame["bytes"]
    start = frame["cluster_start"]
    if frame["cmd"] == "06" and start is not None:
        rp = frame.get("report_params")
        prefix = "batch" if frame["section"] == "batch_params" else "standard"
        min_label = "@echantLabel" if prefix == "batch" else "@measureLabel"
        max_label = "@emitLabel" if prefix == "batch" else "@emitMaxLabel"
        report_config = frame.get("report_config")

        if is_batch_report_params(rp) and len(bytes_list) > start + 9:
            segments.append(("batch_echant", min_label, start + 6, start + 7, "timeVal", "timeSlider"))
            segments.append(("batch_emission", max_label, start + 8, start + 9, "timeVal", "timeSlider"))
            return [s for s in segments if 0 <= s[2] <= s[3] < len(frame["bytes"])]

        if is_batch_report_params(rp) or frame["section"] != "standard_params":
            return []

        if frame["cluster"] == "0406":
            if len(bytes_list) > start + 8:
                segments.append(("stand_emission", "@emitMaxLabel", start + 7, start + 8, "timeVal", "timeSlider"))
            return [s for s in segments if 0 <= s[2] <= s[3] < len(frame["bytes"])]

        if report_config and report_config.get("new_mode"):
            min_start, min_end = report_config["min_interval"]
            max_start, max_end = report_config["max_interval"]
            segments.append(("stand_echant", min_label, min_start, min_end, "timeVal", "timeSlider"))
            segments.append(("stand_emission", max_label, max_start, max_end, "timeVal", "timeSlider"))
            for criterion in report_config["criteria"]:
                if criterion["mode"] not in (1, 2, 3) or "value" not in criterion:
                    continue
                value_start, value_end = criterion["value"]
                if criterion["mode"] in (2, 3) and "gap" in criterion:
                    gap_start, gap_end = criterion["gap"]
                    field_type = "float" if report_config["attr_type"].lower() == "39" else f"hex{value_end - value_start + 1}B"
                    segments.append((
                        f"notification_slot_{criterion['slot']}",
                        "@thresholdLabel",
                        value_start,
                        value_end,
                        field_type,
                        "slider",
                    ))
                    segments.append((
                        f"gap_slot_{criterion['slot']}",
                        "@gapLabel",
                        gap_start,
                        gap_end,
                        field_type,
                        "slider",
                    ))
                elif criterion["mode"] == 1:
                    field_type = "float" if report_config["attr_type"].lower() == "39" else f"hex{value_end - value_start + 1}B"
                    segments.append((f"delta_slot_{criterion['slot']}", "@thresholdLabel", value_start, value_end, field_type, "slider"))
            return [s for s in segments if 0 <= s[2] <= s[3] < len(frame["bytes"])]

        if len(bytes_list) > start + 9:
            segments.append(("stand_echant", min_label, start + 6, start + 7, "timeVal", "timeSlider"))
            segments.append(("stand_emission", max_label, start + 8, start + 9, "timeVal", "timeSlider"))

        if (
            frame["cluster"] in {"800a", "800b"}
            and len(bytes_list) > start + 16
            and bytes_list[start + 5].lower() == "41"
        ):
            data_start = start + 11
            electrical_fields = [
                ("electric_vrms", "@vrmsLabel", data_start, data_start + 1),
                ("electric_irms", "@irmsLabel", data_start + 2, data_start + 3),
                ("electric_angle", "@angleLabel", data_start + 4, data_start + 5),
            ]
            for base, label, field_start, field_end in electrical_fields:
                segments.append((base, label, field_start, field_end, "hex2B", "numInput"))

        threshold_markers = (("70", "71"), ("F0", "F1"))
        for low_marker, high_marker in threshold_markers:
            first_marker_idx = next((i for i, b in enumerate(bytes_list) if b.upper() == low_marker), None)
            second_marker_idx = next((i for i, b in enumerate(bytes_list) if b.upper() == high_marker and (first_marker_idx is None or i > first_marker_idx)), None)
            if first_marker_idx is not None and second_marker_idx is not None and first_marker_idx + 2 < len(bytes_list) and second_marker_idx + 2 < len(bytes_list):
                segments.append(("notification", "@thresholdLabel", first_marker_idx + 1, first_marker_idx + 2, "hex2B", "doubleSlider", second_marker_idx + 1, second_marker_idx + 2))
                break
    if frame["cmd"] == "05" and frame["cluster"] == "0050":
        raw = compact_hex(bytes_list)
        if "ff06" in raw:
            idx = raw.index("ff06") // 2 + 2
            segments.append(("activation_time", "ActivationTime", idx, idx + 1, "timeVal", "timeSliderHHMM"))
        for i, b in enumerate(bytes_list):
            if b == "80" and i + 1 < len(bytes_list) and bytes_list[i + 1] in {"03", "05"}:
                segments.append((f"delay_{i}", "@delayLabel", i, i + 1, "timeVal", "timeSlider"))
    if frame["cmd"] == "05" and frame["cluster"] == "800f" and start is not None:
        payload_start = start + 6
        payload_length = int(bytes_list[start + 5], 16) if len(bytes_list) > start + 5 else 0
        is_xyz_params = (
            len(bytes_list) >= payload_start + payload_length
            and len(bytes_list) > start + 5
            and bytes_list[start + 2:start + 6] == ["80", "00", "41", f"{payload_length:02X}"]
            and payload_length >= 23
        )
        if is_xyz_params:
            for base, label, rel_start, rel_end, field_type, visual_type in XYZ_ACCELERATION_PARAMS:
                segments.append((base, label, payload_start + rel_start, payload_start + rel_end, field_type, visual_type))
    return [s for s in segments if 0 <= s[2] <= s[3] < len(frame["bytes"])]


def make_decoder_link(frame):
    query = urlencode({"trame": "".join(frame["bytes"]), "MySelectMenu": "0", "submit": "Submit"})
    return f"{DECODER_URL}?{query}"


@st.cache_data(show_spinner=False, ttl=3600)
def fetch_watteco_decode(frame_hex):
    params = {"trame": frame_hex, "MySelectMenu": "0", "submit": "Submit"}
    headers = {"User-Agent": "EasyCodecTool/1.0"}
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    response = requests.get(DECODER_URL, params=params, timeout=12, headers=headers, verify=False)
    response.raise_for_status()
    return response.text


def extract_watteco_decoded_text(html):
    match = re.search(r"(?is)<textarea\b[^>]*>(.*?)</textarea>", html)
    if not match:
        return ""
    return html_unescape(match.group(1)).strip()


def parse_watteco_decoded_json(decoded_text):
    if not decoded_text:
        return None
    start = decoded_text.find("\n{")
    payload = decoded_text[start + 1:] if start >= 0 else decoded_text
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


def watteco_decode_frame(frame):
    html = fetch_watteco_decode("".join(frame["bytes"]))
    decoded_text = extract_watteco_decoded_text(html)
    return {
        "text": decoded_text,
        "json": parse_watteco_decoded_json(decoded_text),
    }


def sanitize_name(value, fallback):
    value = re.sub(r"[^0-9A-Za-z_]", "_", value.strip())
    value = re.sub(r"_+", "_", value).strip("_")
    if not value:
        value = fallback
    if value[0].isdigit():
        value = f"v_{value}"
    return value


def segment_default_value(bytes_list, start, end, field_type=None, visual_type=None):
    raw = "".join(bytes_list[start:end + 1])
    try:
        if visual_type == "doubleSlider" and field_type == "float" and len(raw) == 16:
            first = struct.unpack(">f", bytes.fromhex(raw[:8]))[0]
            second = struct.unpack(">f", bytes.fromhex(raw[8:]))[0]
            return f"{first:.6g} {second:.6g}"
        if visual_type == "doubleSlider" and field_type and field_type.startswith("hex"):
            byte_count = int(field_type.removeprefix("hex").removesuffix("B"))
            chunk_size = byte_count * 2
            if len(raw) == chunk_size * 2:
                first = int(raw[:chunk_size], 16)
                second = int(raw[chunk_size:], 16)
                return f"{first} {second}"
        if field_type == "float" and len(raw) == 8:
            value = struct.unpack(">f", bytes.fromhex(raw))[0]
            return f"{value:.6g}"
        value = int(raw, 16)
        if value >= 0x8000 and len(raw) == 4:
            value -= 0x8000
        return str(value)
    except ValueError:
        return raw


def segment_default_value_from_parts(bytes_list, start, end, field_type=None, visual_type=None, second_start=None, second_end=None):
    if second_start is None or second_end is None:
        return segment_default_value(bytes_list, start, end, field_type, visual_type)
    first = segment_default_value(bytes_list, start, end, field_type, None)
    second = segment_default_value(bytes_list, second_start, second_end, field_type, None)
    return f"{first} {second}"


def segment_bounds_defaults(field_type, visual_type, label, start, end, cluster):
    if visual_type == "timeSliderHHMM":
        return "0", "1439", "1"
    if field_type == "timeVal" or visual_type == "timeSlider":
        return "1", "1440", "1"
    if field_type == "bool" or visual_type == "checkbox":
        return "", "", ""
    if field_type == "float" and label in {"@thresholdLabel", "@gapLabel"}:
        return THRESHOLD_BOUNDS_BY_CLUSTER.get(cluster, ("", "", ""))
    if label in {"@thresholdXLabel", "@thresholdYLabel", "@thresholdZLabel"}:
        return THRESHOLD_BOUNDS_BY_CLUSTER.get(cluster, ("", "", ""))
    if visual_type == "doubleSlider":
        return THRESHOLD_BOUNDS_BY_CLUSTER.get(cluster, ("", "", ""))
    return "", "", ""


def default_dropdown_choices_text(default_value):
    return str(default_value).strip() if default_value else ""


def parse_dropdown_choices(raw_choices, custom_localizations, fallback_prefix):
    choices = []
    for line_index, raw_line in enumerate(raw_choices.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            choices.append(line)
            continue

        value, label_part = line.split(":", 1)
        value = value.strip()
        label_part = label_part.strip()
        if not value:
            continue
        if not label_part:
            choices.append(value)
            continue

        if "|" in label_part:
            label_fr, label_en = [part.strip() for part in label_part.split("|", 1)]
        else:
            label_fr = label_part
            label_en = auto_translate_to_en(label_part)

        if label_fr.startswith("@"):
            label_ref = label_fr
        else:
            label_ref = register_localized_ref(
                label_fr,
                label_en,
                "Choice",
                f"{fallback_prefix}_{line_index}",
                custom_localizations,
            )
        choices.append([value, label_ref])
    return choices


def suggestion_display_label(base, label):
    xyz_labels = {
        "xyz_wait_freq": "WaitFreq",
        "xyz_acq_freq": "AcqFreq",
        "xyz_new_wait_delay": "NewWaitDelay",
        "xyz_max_acq_duration": "MaxAcqDuration",
        "xyz_threshold_x": "Seuil X",
        "xyz_threshold_y": "Seuil Y",
        "xyz_threshold_z": "Seuil Z",
        "xyz_over_threshold_delay": "OverThrshDt",
        "xyz_under_threshold_delay": "UnderThrshDt",
        "xyz_range": "Range",
        "xyz_filter_smooth_coef": "FilterSmoothCoef",
        "xyz_filter_gain_coef": "FilterGainCoef",
        "xyz_wake_mode": "WakeMode",
        "electric_vrms": "Vrms",
        "electric_irms": "Irms",
        "electric_angle": "Angle",
    }
    if base in xyz_labels:
        return xyz_labels[base]
    if base in {"stand_echant", "batch_echant"}:
        return "Mesure"
    if base in {"stand_emission", "batch_emission"}:
        return "Emission"
    if base.startswith("notification_slot_"):
        return f"Seuil {base.rsplit('_', 1)[-1]}"
    if base.startswith("gap_slot_"):
        return f"Gap {base.rsplit('_', 1)[-1]}"
    if base.startswith("delta_slot_"):
        return f"Delta {base.rsplit('_', 1)[-1]}"
    if base.startswith("support_time_"):
        return "Temps possible (support)"
    if base.startswith("support_threshold_"):
        return "Seuil possible (support)"
    if base in {"notification", "threshold"}:
        return "Seuil"
    if base in {"notification_gap", "gap"}:
        return "Gap"
    return label.lstrip("@")


def default_variable_name(group, base, fallback):
    group_prefixes = {
        "standard_T_params": "t",
        "standard_H_params": "h",
        "standard_CO2_params": "c",
        "standard_C_params": "c",
        "standard_I_params": "i",
        "standard_O_params": "o",
        "standard_B_params": "b",
        "standard_A_params": "a",
        "standard_E_params": "e",
        "standard_XYZ_params": "xyz",
        "configuration_frames": "cfg",
        "batch_T_params": "t",
        "batch_H_params": "h",
        "batch_CO2_params": "c",
        "batch_I_params": "i",
        "batch_O_params": "o",
        "batch_B_params": "b",
        "batch_A_params": "a",
        "batch_E_params": "e",
    }
    prefix = group_prefixes.get(group, sanitize_name(group, "param"))
    if base in {"stand_echant", "min_interval"}:
        return f"{prefix}StandEchant"
    if base in {"stand_emission", "max_interval"}:
        return f"{prefix}StandEmission"
    if base in {"batch_echant"}:
        return f"{prefix}BatchEchant"
    if base in {"batch_emission"}:
        return "gBatchEmission"
    if base in {"notification", "threshold"} or base.startswith("threshold"):
        return f"{prefix}Notification"
    if base in {"notification_gap", "gap"}:
        return f"{prefix}NotificationGap"
    if base.startswith("notification_slot_"):
        slot = base.rsplit("_", 1)[-1]
        return f"{prefix}NotificationSlot{slot}"
    if base.startswith("gap_slot_"):
        slot = base.rsplit("_", 1)[-1]
        return f"{prefix}GapSlot{slot}"
    if base.startswith("delta_slot_"):
        slot = base.rsplit("_", 1)[-1]
        return f"{prefix}DeltaSlot{slot}"
    if base.startswith("support_time_"):
        suffix = base.rsplit("_", 1)[-1]
        return f"{prefix}SupportTime{suffix}"
    if base.startswith("support_threshold_"):
        suffix = base.rsplit("_", 1)[-1]
        return f"{prefix}SupportThreshold{suffix}"
    return sanitize_name(f"{prefix}_{base}", fallback)


SHARED_VARIABLE_NAMES = {"gBatchEmission"}


def variable_identity(section, group, base):
    if base == "batch_emission":
        return ("shared", "gBatchEmission")
    return (section, sanitize_name(group, "group"), base)


def unique_variable_name(base_name, used_counts):
    base_name = sanitize_name(base_name, "param")
    if base_name in SHARED_VARIABLE_NAMES:
        return base_name
    count = used_counts.get(base_name, 0) + 1
    used_counts[base_name] = count
    if count == 1:
        return base_name
    return f"{base_name}_{count}"


def apply_segments(frame, segments):
    tokens = list(frame["bytes"])
    grouped_fields = {}
    occupied = set()
    ordered_segments = sorted(segments, key=lambda item: item["start"])
    emission_by_group = {
        segment["target_group"]: segment["name"]
        for segment in segments
        if segment.get("base") == "stand_emission"
    }

    for segment in ordered_segments:
        start = segment["start"]
        end = segment["end"]
        if start > end or any(i in occupied for i in range(start, end + 1)):
            continue
        for i in range(start, end + 1):
            occupied.add(i)

        name = segment["name"]
        if segment["visual_type"] == "doubleSlider" and segment.get("second_start") is not None:
            second_start = segment["second_start"]
            second_end = segment["second_end"]
            if any(i in occupied for i in range(second_start, second_end + 1)):
                continue
            for i in range(second_start, second_end + 1):
                occupied.add(i)
            tokens[start] = f"({name}1)"
            for i in range(start + 1, end + 1):
                tokens[i] = ""
            tokens[second_start] = f"({name}2)"
            for i in range(second_start + 1, second_end + 1):
                tokens[i] = ""
        elif segment["visual_type"] == "doubleSlider" and end > start:
            size = end - start + 1
            midpoint = start + size // 2
            tokens[start] = f"({name}1)"
            for i in range(start + 1, midpoint):
                tokens[i] = ""
            tokens[midpoint] = f"({name}2)"
            for i in range(midpoint + 1, end + 1):
                tokens[i] = ""
        else:
            tokens[start] = f"({name})"
            for i in range(start + 1, end + 1):
                tokens[i] = ""

        if segment.get("reuse_existing"):
            continue

        field = {
            "type": segment["type"],
            "default_value": segment["default_value"],
            "HMI": {
                "label": segment["label"],
                "visual_type": segment["visual_type"],
            },
        }
        for key in ("min_value", "max_value", "step"):
            if segment.get(key):
                field[key] = segment[key]
        if segment.get("base") == "batch_echant":
            field["depends_on"] = "gBatchEmission"
        elif segment.get("base") == "stand_echant":
            emission_name = emission_by_group.get(segment["target_group"])
            if emission_name:
                field["depends_on"] = emission_name
        if segment["visual_type"] == "dropdown":
            field["choices"] = segment.get("choices", [])
        if segment["visual_type"] == "timeSliderHHMM":
            field["HMI"]["outputFormat"] = "HHMM"
        semantic_label = segment.get("semantic_label", segment["label"])
        threshold_labels = {"@thresholdLabel", "@gapLabel", "@thresholdXLabel", "@thresholdYLabel", "@thresholdZLabel"}
        if segment["visual_type"] == "doubleSlider" or semantic_label in threshold_labels:
            field["HMI"].update(THRESHOLD_HMI_BY_CLUSTER.get(segment.get("cluster"), {}))

        target_group = segment["target_group"]
        if target_group not in grouped_fields:
            grouped_fields[target_group] = {
                "label": segment["target_group_label"],
                "default_state": segment["target_default_state"],
                "fields": {},
            }
        grouped_fields[target_group]["fields"][name] = field

    return " ".join(t for t in tokens if t), grouped_fields


def ensure_remove_config(json_data):
    general = json_data.setdefault("general_params", {})
    general.setdefault("remove_config", {
        "label": "@removeCurrentConfigLabel",
        "default_state": "true",
        "fields": {
            "removeCurrentConfig": {
                "type": "frame",
                "HMI": {
                    "label": "@removeCurrentConfigLabel",
                    "visual_type": "customFrame",
                },
            },
        },
    })
    general.setdefault("cfg_block", [])


def ensure_confirmed_config(json_data):
    general = json_data.setdefault("general_params", {})
    general.setdefault("confirmed", {
        "label": "@confirmedLabel",
        "default_state": "true",
        "fields": {
            "confirmed": {
                "type": "bool",
                "default_value": "false",
                "HMI": {
                    "label": "@confirmedLabel",
                    "visual_type": "checkbox",
                },
            },
        },
    })
    general.setdefault("cfg_block", [])


def ensure_pullout_config(json_data):
    general = json_data.setdefault("general_params", {})
    general.setdefault("pullout_config", {
        "label": "@reportOnSensorPulloutLabel",
        "default_state": "true",
        "fields": {
            "reportOnSensorPullout": {
                "type": "frame",
                "HMI": {
                    "label": "@reportOnSensorPulloutLabel",
                    "visual_type": "customFrame",
                },
            },
        },
    })
    general.setdefault("cfg_block", [])


def ensure_remove_header_config(json_data):
    general = json_data.setdefault("general_params", {})
    general.setdefault("remove_header", {
        "label": "@removeHeaderLabel",
        "default_state": "true",
        "fields": {
            "remove": {
                "type": "bool",
                "default_value": "false",
                "inverted": "true",
                "HMI": {
                    "label": "@removeHeaderLabel",
                    "visual_type": "checkbox",
                },
            },
        },
    })
    general.setdefault("cfg_block", [])


def ensure_batch_global_params(json_data):
    batch = json_data.setdefault("batch_params", {})
    batch.setdefault("global_params", {
        "fields": {
            "gBatchEmission": {
                "type": "timeVal",
                "default_value": "60",
                "min_value": "1",
                "max_value": "1440",
                "step": "1",
                "HMI": {
                    "label": "@emitLabel",
                    "visual_type": "timeSlider",
                },
            },
        },
    })
    batch.setdefault("cfg_block", [])


def is_remove_config_frame(frame):
    return compact_hex(frame["bytes"]) == "115000500203"


def is_confirmed_frame(frame):
    return compact_hex(frame["bytes"]) in {"11058004000008", "1105800400000800"}


def is_pullout_frame(frame):
    return compact_hex(frame["bytes"]) == "1106000f000055100001ffff01"


def is_remove_header_frame(frame):
    return compact_hex(frame["bytes"]) == "11058009000110"


def is_ctn_config_frame(frame):
    raw = compact_hex(frame["bytes"])
    return raw.startswith(("1105040290014110", "3105040290014110"))


def format_cfg_frame(bytes_list):
    return " ".join(bytes_list)


def general_preset(frame):
    if is_remove_config_frame(frame):
        return {
            "name": "remove_config",
            "group": "remove_config",
            "comment": "@cfgCommentRemoveConfig",
            "frame": "11 50 00 50 02 03(removeCurrentConfig)",
        }
    if is_pullout_frame(frame):
        return {
            "name": "pullout_config",
            "group": "pullout_config",
            "comment": "@cfgCommentPullOut",
            "frame": f"{format_cfg_frame(frame['bytes'])}(reportOnSensorPullout)",
        }
    if is_confirmed_frame(frame):
        return {
            "name": "confirmed",
            "group": "confirmed",
            "comment": "@cfgCommentConfirmed",
            "frame": "11 05 8004 0000 08 (confirmed)",
        }
    if is_remove_header_frame(frame):
        return {
            "name": "remove_header",
            "group": "remove_header",
            "comment": "@cfgCommentRemoveHeader",
            "frame": "11 05 8009 0001 10 (remove)",
        }
    if is_ctn_config_frame(frame):
        return {
            "name": "ctn_config",
            "group": "",
            "comment": "@cfgCommentCTNConfiguration",
            "frame": format_cfg_frame(frame["bytes"]),
        }
    return None


def apply_general_preset(json_data, preset):
    if preset["name"] == "remove_config":
        ensure_remove_config(json_data)
    elif preset["name"] == "pullout_config":
        ensure_pullout_config(json_data)
    elif preset["name"] == "confirmed":
        ensure_confirmed_config(json_data)
    elif preset["name"] == "remove_header":
        ensure_remove_header_config(json_data)
    else:
        json_data.setdefault("general_params", {}).setdefault("cfg_block", [])
    json_data["general_params"]["cfg_block"].append([preset["frame"], preset["comment"]])


def ensure_group(json_data, section, group, label, default_state):
    if section not in json_data:
        json_data[section] = {}
    if section == "batch_params":
        ensure_batch_global_params(json_data)
    if group not in json_data[section]:
        json_data[section][group] = {
            "label": label,
            "default_state": default_state,
            "fields": {},
        }
    if "fields" not in json_data[section][group]:
        json_data[section][group]["fields"] = {}
    if "cfg_block" not in json_data[section]:
        json_data[section]["cfg_block"] = []


def base_json_structure():
    return {}


def prune_empty_sections(value):
    if isinstance(value, dict):
        pruned = {}
        for key, item in value.items():
            cleaned = prune_empty_sections(item)
            if cleaned in ({}, []):
                if key == "fields":
                    pruned[key] = cleaned
                continue
            pruned[key] = cleaned
        return pruned
    return value


def move_cfg_block_last(json_data):
    for section_data in json_data.values():
        if isinstance(section_data, dict) and "cfg_block" in section_data:
            cfg_block = section_data.pop("cfg_block")
            section_data["cfg_block"] = cfg_block
    return json_data


def cfg_frame_signature(frame_value):
    if not isinstance(frame_value, str):
        return ""
    return re.sub(r"\s+", "", frame_value).lower()


def cfg_block_item_signature(item):
    if not isinstance(item, list) or not item:
        return ""
    frame_signature = cfg_frame_signature(item[0])
    comment_signature = item[1] if len(item) > 1 and isinstance(item[1], str) else ""
    return f"{frame_signature}|{comment_signature}"


def merge_cfg_block(existing_block, generated_block):
    merged = list(existing_block or [])
    seen = {
        cfg_block_item_signature(item)
        for item in merged
        if isinstance(item, list) and item
    }
    added = 0
    skipped = 0
    for item in generated_block or []:
        if not isinstance(item, list) or not item:
            continue
        signature = cfg_block_item_signature(item)
        if signature and signature in seen:
            skipped += 1
            continue
        merged.append(copy.deepcopy(item))
        if signature:
            seen.add(signature)
        added += 1
    return merged, added, skipped


def merge_easy_codec_json(existing_json, generated_json, overwrite_fields=False):
    merged = copy.deepcopy(existing_json or {})
    stats = {
        "sections_added": 0,
        "groups_added": 0,
        "fields_added": 0,
        "fields_updated": 0,
        "frames_added": 0,
        "frames_skipped": 0,
    }

    for section, generated_section in (generated_json or {}).items():
        if section not in merged or not isinstance(merged.get(section), dict):
            merged[section] = copy.deepcopy(generated_section)
            stats["sections_added"] += 1
            if isinstance(generated_section, dict):
                stats["groups_added"] += len([key for key in generated_section if key != "cfg_block"])
                stats["frames_added"] += len(generated_section.get("cfg_block", []) or [])
            continue

        if not isinstance(generated_section, dict):
            if overwrite_fields:
                merged[section] = copy.deepcopy(generated_section)
            continue

        for key, generated_value in generated_section.items():
            if key == "cfg_block":
                merged_block, added, skipped = merge_cfg_block(merged[section].get("cfg_block", []), generated_value)
                merged[section]["cfg_block"] = merged_block
                stats["frames_added"] += added
                stats["frames_skipped"] += skipped
                continue

            if key not in merged[section] or not isinstance(merged[section].get(key), dict):
                merged[section][key] = copy.deepcopy(generated_value)
                stats["groups_added"] += 1
                stats["fields_added"] += len((generated_value or {}).get("fields", {}) or []) if isinstance(generated_value, dict) else 0
                continue

            existing_group = merged[section][key]
            generated_group = generated_value if isinstance(generated_value, dict) else {}
            for meta_key in ("label", "default_state"):
                if meta_key not in existing_group and meta_key in generated_group:
                    existing_group[meta_key] = copy.deepcopy(generated_group[meta_key])

            existing_fields = existing_group.setdefault("fields", {})
            for field_name, field_value in (generated_group.get("fields", {}) or {}).items():
                if field_name in existing_fields:
                    if overwrite_fields:
                        existing_fields[field_name] = copy.deepcopy(field_value)
                        stats["fields_updated"] += 1
                    continue
                existing_fields[field_name] = copy.deepcopy(field_value)
                stats["fields_added"] += 1

    return move_cfg_block_last(prune_empty_sections(merged)), stats


def build_json(frames, settings):
    json_data = base_json_structure()
    for idx, frame in enumerate(frames):
        if not settings[idx]["include"]:
            continue
        section = settings[idx]["section"]
        group = settings[idx]["group"]
        group_label = settings[idx]["group_label"]
        default_state = settings[idx]["default_state"]
        frame_payload, grouped_fields = apply_segments(frame, settings[idx]["segments"])
        preset = general_preset(frame)
        if not grouped_fields and preset:
            apply_general_preset(json_data, preset)
            continue
        if grouped_fields:
            for target_group, target_data in grouped_fields.items():
                target_fields = dict(target_data["fields"])
                if section == "batch_params" and "gBatchEmission" in target_fields:
                    ensure_batch_global_params(json_data)
                    json_data["batch_params"]["global_params"]["fields"]["gBatchEmission"].update(
                        target_fields.pop("gBatchEmission")
                    )
                if target_fields:
                    ensure_group(
                        json_data,
                        section,
                        target_group,
                        target_data["label"],
                        target_data["default_state"],
                    )
                    json_data[section][target_group]["fields"].update(target_fields)
        elif settings[idx]["frame_field"]:
            ensure_group(json_data, section, group, group_label, default_state)
            field_name = sanitize_name(settings[idx]["frame_field"], f"frame_{idx + 1}")
            frame_payload = f"{frame_payload}({field_name})"
            json_data[section][group]["fields"][field_name] = {
                "type": "frame",
                "HMI": {
                    "label": settings[idx]["comment_label"],
                    "visual_type": "customFrame",
                },
            }
        elif section not in json_data:
            json_data[section] = {"cfg_block": []}
        elif "cfg_block" not in json_data[section]:
            json_data[section]["cfg_block"] = []
        json_data[section]["cfg_block"].append([frame_payload, settings[idx]["comment_label"]])
    return move_cfg_block_last(prune_empty_sections(json_data))


def placeholder_validation(json_data):
    declared = set()
    used = set()
    for section_data in json_data.values():
        for group_name, group_data in section_data.items():
            if group_name == "cfg_block":
                for frame, _comment in group_data:
                    used.update(re.findall(r"\(([A-Za-z0-9_]+)\)", frame))
            elif isinstance(group_data, dict):
                declared.update(group_data.get("fields", {}).keys())
    return sorted(used - declared), sorted(declared - used)


def collect_localization_refs(value):
    refs = set()
    if isinstance(value, dict):
        for item in value.values():
            refs.update(collect_localization_refs(item))
    elif isinstance(value, list):
        for item in value:
            refs.update(collect_localization_refs(item))
    elif isinstance(value, str):
        refs.update(re.findall(r"@([A-Za-z0-9_]+)", value))
    return refs


def load_localization_keys():
    keys_by_lang = {}
    for project_path in EASY_CODEC_PROJECT_CANDIDATES:
        base = project_path / "public" / "localisation"
        fr_path = base / "fr_FR.json"
        en_path = base / "en_US.json"
        if fr_path.exists() and en_path.exists():
            for lang, path in (("FR", fr_path), ("US", en_path)):
                try:
                    keys_by_lang[lang] = set(json.loads(path.read_text(encoding="utf-8-sig")).keys())
                except json.JSONDecodeError:
                    keys_by_lang[lang] = set()
            return keys_by_lang
    return {}


def localization_validation(json_data):
    keys_by_lang = load_localization_keys()
    if not keys_by_lang:
        return {}
    refs = collect_localization_refs(json_data)
    return {
        lang: sorted(refs - keys)
        for lang, keys in keys_by_lang.items()
        if refs - keys
    }


def find_easy_codec_project():
    for project_path in EASY_CODEC_PROJECT_CANDIDATES:
        available_list = project_path / "public" / "config" / "AvailableProductList.json"
        fr_path = project_path / "public" / "localisation" / "fr_FR.json"
        en_path = project_path / "public" / "localisation" / "en_US.json"
        if available_list.exists() and fr_path.exists() and en_path.exists():
            return project_path
    return None


def read_json_file(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def display_product_value(value):
    if isinstance(value, list):
        return " ".join(display_product_value(item) for item in value)
    if isinstance(value, dict):
        return " ".join(display_product_value(item) for item in value.values())
    return "" if value is None else str(value)


def support_search_words(*values):
    ignored = {"config", "default", "rom", "avec", "sans", "conf"}
    text = " ".join(display_product_value(value) for value in values)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    words = {
        word.lower()
        for word in re.findall(r"[A-Za-z0-9]+", text)
        if len(word) >= 4 and word.lower() not in ignored
    }
    return words


def local_product_lists():
    return [
        ROOT / "data" / "AvailableProductList.json",
        ROOT / "AvailableProductList.json",
        ROOT / "data" / "AvailableProductsList.with_romcfg.json",
        ROOT / "AvailableProductsList.with_romcfg.json",
    ]


def find_support_url_for_context(product_file="", product_name="", source_label=""):
    context_words = support_search_words(product_file, product_name, Path(source_label).stem if source_label else "")
    if not context_words and not product_file:
        return ""

    best = None
    best_score = 0
    for path in local_product_lists():
        if not path.exists():
            continue
        try:
            products = read_json_file(path).get("products", [])
        except (OSError, json.JSONDecodeError):
            continue
        for product in products:
            doc_link = product.get("docLink", "")
            if not doc_link:
                continue
            file_name = display_product_value(product.get("file", ""))
            if product_file and file_name.lower() == product_file.lower():
                return doc_link
            product_words = support_search_words(
                product.get("name", ""),
                product.get("file", ""),
                product.get("category", ""),
                doc_link,
            )
            score = len(context_words & product_words)
            if score > best_score:
                best = doc_link
                best_score = score
    return best if best_score else ""


def write_json_file(path, data):
    path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")


def sanitize_config_file_name(value, fallback="easy_codec_config"):
    value = value.strip()
    if value.lower().endswith(".json"):
        value = value[:-5]
    value = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "-", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or fallback


def upsert_product_entry(available_products, product_entry):
    products = available_products.setdefault("products", [])
    for index, product in enumerate(products):
        if product.get("file") == product_entry["file"]:
            existing_apps = product.get("apps", [])
            merged_apps = list(dict.fromkeys([*existing_apps, *product_entry.get("apps", [])]))
            products[index] = {**product, **product_entry, "apps": merged_apps}
            return "modifie"
    products.append(product_entry)
    return "ajoute"


def default_easy_codec_paths(project_path):
    public_dir = project_path / "public"
    return {
        "config_dir": public_dir / "config",
        "available_products_path": public_dir / "config" / "AvailableProductList.json",
        "fr_localization_path": public_dir / "localisation" / "fr_FR.json",
        "en_localization_path": public_dir / "localisation" / "en_US.json",
    }


def apply_localization_suggestions(project_path, suggestions, localization_paths=None):
    added = {"fr_FR": [], "en_US": []}
    default_paths = default_easy_codec_paths(project_path)
    paths = localization_paths or {}
    lang_paths = {
        "fr_FR": Path(paths.get("fr_FR", default_paths["fr_localization_path"])),
        "en_US": Path(paths.get("en_US", default_paths["en_localization_path"])),
    }
    for lang_file in ("fr_FR", "en_US"):
        path = lang_paths[lang_file]
        data = read_json_file(path)
        for key, value in suggestions.get(lang_file, {}).items():
            if key not in data:
                data[key] = value
                added[lang_file].append(key)
        write_json_file(path, data)
    return added


def transmit_to_easy_codec(project_path, json_data, suggestions, product_entry, output_paths=None):
    default_paths = default_easy_codec_paths(project_path)
    output_paths = output_paths or {}
    config_dir = Path(output_paths.get("config_dir", default_paths["config_dir"]))
    destination = Path(output_paths.get("destination", config_dir / f"{product_entry['file']}.json"))
    available_products_path = Path(output_paths.get("available_products_path", default_paths["available_products_path"]))
    localization_paths = {
        "fr_FR": output_paths.get("fr_localization_path", default_paths["fr_localization_path"]),
        "en_US": output_paths.get("en_localization_path", default_paths["en_localization_path"]),
    }

    available_products = read_json_file(available_products_path)
    product_action = upsert_product_entry(available_products, product_entry)

    destination.parent.mkdir(parents=True, exist_ok=True)
    write_json_file(destination, json_data)
    write_json_file(available_products_path, available_products)
    added_localizations = apply_localization_suggestions(project_path, suggestions, localization_paths)

    return {
        "destination": destination,
        "available_products_path": available_products_path,
        "product_action": product_action,
        "added_localizations": added_localizations,
    }


def localized_cfg_comment(raw):
    subject_labels = {
        "Analog": ("analog input", "entree analogique"),
        "Temp": ("temperature", "temperature"),
        "Hum": ("humidity", "humidite"),
        "CO2": ("CO2", "CO2"),
        "Occupancy": ("presence", "presence"),
        "Illuminance": ("light", "luminosite"),
        "Pressure": ("pressure", "pression"),
        "Battery": ("battery", "batterie"),
        "State": ("state", "etat"),
        "Frame": ("frame", "trame"),
    }
    action_labels = {
        "Period": ("periodic report", "releve periodique"),
        "Threshold": ("threshold", "seuil"),
        "ThresholdHigh": ("high threshold", "seuil haut"),
        "ThresholdLow": ("low threshold", "seuil bas"),
        "Delta": ("delta report", "releve sur variation"),
        "Action": ("threshold action", "action sur seuil"),
    }
    match = re.fullmatch(r"(Stand|Batch)([A-Za-z0-9]+?)(Period|ThresholdHigh|ThresholdLow|Threshold|Delta|Action)", raw)
    if match:
        mode, subject, action = match.groups()
        en_subject, fr_subject = subject_labels.get(subject, (subject, subject))
        en_action, fr_action = action_labels[action]
        if mode == "Batch":
            return {
                "FR": f"Batch {fr_subject}",
                "US": f"{en_subject.capitalize()} batch",
            }
        return {
            "FR": f"{fr_action.capitalize()} {fr_subject}",
            "US": f"{en_action.capitalize()} {en_subject}",
        }
    match = re.fullmatch(r"Config([A-Za-z0-9]+)", raw)
    if match:
        subject = match.group(1)
        en_subject, fr_subject = subject_labels.get(subject, (subject, subject))
        return {
            "FR": f"Configuration {fr_subject}",
            "US": f"{en_subject.capitalize()} configuration",
        }
    return None


def label_from_key(key):
    if key in LOCALIZATION_SUGGESTIONS:
        en_text, fr_text = LOCALIZATION_SUGGESTIONS[key]
        return {"FR": fr_text, "US": en_text}
    if key.startswith("cfgComment"):
        raw = key.removeprefix("cfgComment")
        localized = localized_cfg_comment(raw)
        if localized:
            return localized
        text = re.sub(r"[_]+", " ", raw).strip()
        text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text).strip()
        if not text:
            text = "Configuration"
        return {"FR": text, "US": text}
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", key)
    text = re.sub(r"[_]+", " ", text).strip()
    return {"FR": text, "US": text}


def localization_suggestions(missing_localizations):
    keys = sorted({key for keys in missing_localizations.values() for key in keys})
    return {
        "fr_FR": {key: label_from_key(key)["FR"] for key in keys},
        "en_US": {key: label_from_key(key)["US"] for key in keys},
    }


FR_EN_PHRASES = {
    "releve periodique": "periodic report",
    "releve sur variation": "delta report",
    "seuil haut": "high threshold",
    "seuil bas": "low threshold",
    "action sur seuil": "threshold action",
    "entree analogique": "analog input",
    "valeur configurable": "configurable value",
    "temps d'activation": "activation time",
    "horaire d'activation": "activation time",
    "raz configuration": "reset config",
    "retrait capteur": "sensor removal",
    "mode confirme": "confirmed mode",
    "trame specifique": "custom frame",
}

FR_EN_WORDS = {
    "activation": "activation",
    "action": "action",
    "alarme": "alarm",
    "analogique": "analog",
    "batterie": "battery",
    "batch": "batch",
    "capteur": "sensor",
    "co2": "CO2",
    "commande": "command",
    "configuration": "configuration",
    "delai": "delay",
    "ecart": "gap",
    "emission": "emission",
    "entete": "header",
    "etat": "state",
    "haut": "high",
    "humidite": "humidity",
    "luminosite": "light",
    "max": "max",
    "min": "min",
    "periode": "period",
    "periodique": "periodic",
    "presence": "presence",
    "pression": "pressure",
    "rapport": "report",
    "releve": "report",
    "retrait": "removal",
    "seuil": "threshold",
    "temperature": "temperature",
    "trame": "frame",
    "variation": "variation",
    "valeur": "value",
}


def strip_accents(value):
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_for_translation(value):
    value = strip_accents(value).lower()
    value = re.sub(r"[^a-z0-9%/ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def auto_translate_to_en(text):
    normalized = normalize_for_translation(text)
    if not normalized:
        return text
    translated = normalized
    for fr_text, en_text in sorted(FR_EN_PHRASES.items(), key=lambda item: len(item[0]), reverse=True):
        translated = re.sub(rf"\b{re.escape(fr_text)}\b", en_text, translated)
    words = [
        FR_EN_WORDS.get(word, word.upper() if word == "co2" else word)
        for word in translated.split()
    ]
    result = " ".join(words).strip()
    return result[:1].upper() + result[1:] if result else text


def localization_key_from_text(prefix, text, fallback):
    cleaned = strip_accents(text)
    words = re.findall(r"[A-Za-z0-9]+", cleaned)
    key_body = "".join(word[:1].upper() + word[1:] for word in words)
    if not key_body:
        key_body = fallback
    return f"{prefix}{key_body}"


def display_text_from_ref(value):
    if isinstance(value, str) and value.startswith("@"):
        return label_from_key(value[1:])["FR"]
    return value


def display_en_from_ref(value):
    if isinstance(value, str) and value.startswith("@"):
        return label_from_key(value[1:])["US"]
    return auto_translate_to_en(value)


def register_localized_ref(text, en_text, prefix, fallback, custom_localizations, existing_ref=None):
    text = text.strip()
    en_text = en_text.strip()
    if not text:
        text = fallback
    if not en_text:
        en_text = auto_translate_to_en(text)
    if text.startswith("@"):
        return text
    if existing_ref and text == display_text_from_ref(existing_ref) and en_text == display_en_from_ref(existing_ref):
        return existing_ref
    key = localization_key_from_text(prefix, text, fallback)
    custom_localizations[key] = {
        "FR": text,
        "US": en_text,
    }
    return f"@{key}"


def merge_localization_suggestions(missing_localizations, custom_localizations):
    suggestions = localization_suggestions(missing_localizations) if missing_localizations else {
        "fr_FR": {},
        "en_US": {},
    }
    for key, texts in custom_localizations.items():
        suggestions["fr_FR"][key] = texts["FR"]
        suggestions["en_US"][key] = texts["US"]
    return suggestions


def query_param_value(name, default=""):
    value = st.query_params.get(name, default)
    if isinstance(value, list):
        return value[0] if value else default
    return value or default


@st.cache_data(show_spinner=False, ttl=3600)
def fetch_support_page(url):
    response = requests.get(url, timeout=12, headers={"User-Agent": "EasyCodecTool/1.0"})
    response.raise_for_status()
    return response.text


def html_to_text(html):
    html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>", "\n", html)
    html = re.sub(r"(?i)</(p|li|div|h[1-6]|tr)>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def html_unescape(text):
    entities = {
        "&nbsp;": " ",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
    }
    for entity, value in entities.items():
        text = text.replace(entity, value)
    return text


def extract_support_links(html, base_url):
    link_matches = re.findall(r'(?is)<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html)
    useful_words = (
        "user guide",
        "guide",
        "specification",
        "documentation",
        "download",
        "pdf",
        "frame",
        "cluster",
        "applicative",
        "codec",
        "configuration",
        "modbus",
        "manual",
        "manuel",
    )
    links = []
    seen = set()
    for href, raw_label in link_matches:
        label = html_to_text(raw_label)
        url = urljoin(base_url, html_unescape(href).strip())
        key = (label.lower(), url.lower())
        if key in seen or not url.startswith(("http://", "https://")):
            continue
        seen.add(key)
        haystack = f"{label} {url}".lower()
        score = sum(1 for word in useful_words if word in haystack)
        if score == 0:
            continue
        links.append({
            "label": label or url,
            "url": url,
            "score": score,
        })
    return sorted(links, key=lambda item: (-item["score"], item["label"].lower()))[:12]


def support_hints_from_text(text):
    keywords = (
        "configuration",
        "configurable",
        "parameter",
        "parametre",
        "paramètre",
        "period",
        "periode",
        "période",
        "threshold",
        "seuil",
        "report",
        "uplink",
        "downlink",
        "batch",
        "measure",
        "mesure",
        "transmission",
        "counter",
        "compteur",
        "input",
        "output",
        "alarm",
        "alarme",
    )
    snippets = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        cleaned = sentence.strip(" -:;")
        if len(cleaned) < 25 or len(cleaned) > 260:
            continue
        lowered = cleaned.lower()
        if any(keyword in lowered for keyword in keywords):
            snippets.append(cleaned)
        if len(snippets) >= 12:
            break
    return snippets


SUPPORT_CONCEPT_KEYWORDS = {
    "period": ("period", "periode", "période", "measure", "mesure", "transmission", "report", "emit", "emission"),
    "batch": ("batch",),
    "threshold": ("threshold", "seuil", "delta", "gap", "hysteresis"),
    "alarm": ("alarm", "alarme", "alert", "exceed", "exceeded", "depasse", "dépasse"),
    "time": ("time", "temps", "delay", "delai", "délai", "activation"),
    "counter": ("counter", "compteur", "pulse", "impulsion", "index"),
    "input_output": ("input", "output", "entree", "entrée", "sortie"),
    "electric": ("current", "courant", "power", "puissance", "energy", "energie", "énergie", "intensity", "intens"),
    "temperature": ("temperature", "température", "temp"),
    "humidity": ("humidity", "humidite", "humidité", "hygro"),
    "co2": ("co2", "voc", "iaq"),
}

SUPPORT_PRODUCT_CONCEPTS = {
    "intenso": {"electric", "period", "batch", "threshold", "alarm"},
    "intens": {"electric", "period", "batch", "threshold", "alarm"},
    "flasho": {"counter", "input_output", "period", "batch"},
    "pulsesenso": {"counter", "input_output", "period", "batch", "threshold"},
    "vaqao": {"co2", "temperature", "humidity", "period", "batch", "threshold", "alarm"},
    "hygro": {"temperature", "humidity", "period", "threshold"},
    "tempo": {"temperature", "period", "threshold"},
    "climo": {"temperature", "humidity", "period", "threshold"},
    "modbus": {"period", "batch", "input_output"},
}

SEGMENT_CONCEPTS = {
    "stand_echant": {"period"},
    "stand_emission": {"period"},
    "batch_echant": {"period", "batch"},
    "batch_emission": {"period", "batch"},
    "activation_time": {"time"},
}


def normalized_support_text(*values):
    text = " ".join(display_product_value(value) for value in values if value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def support_context_from_sources(url="", product_file="", product_name="", category="", source_label="", support_text="", support_links=None):
    link_text = " ".join(f"{item.get('label', '')} {item.get('url', '')}" for item in (support_links or []))
    text = normalized_support_text(url, product_file, product_name, category, source_label, support_text, link_text)
    concepts = set()
    for concept, keywords in SUPPORT_CONCEPT_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            concepts.add(concept)
    for marker, marker_concepts in SUPPORT_PRODUCT_CONCEPTS.items():
        if marker in text:
            concepts.update(marker_concepts)
    return {
        "text": text,
        "concepts": concepts,
        "has_support": bool(url or support_text or support_links),
    }


def suggestion_concepts(suggestion):
    base = suggestion[0]
    if base in SEGMENT_CONCEPTS:
        return SEGMENT_CONCEPTS[base]
    if base.startswith(("notification", "threshold", "gap", "delta", "support_threshold")):
        return {"threshold", "alarm"}
    if base.startswith(("delay", "support_time")):
        return {"time", "period"}
    return set()


def support_match_for_suggestion(suggestion, support_context):
    matched = suggestion_concepts(suggestion) & support_context.get("concepts", set())
    if not matched:
        return 0, ""
    labels = {
        "period": "periode",
        "batch": "batch",
        "threshold": "seuil",
        "alarm": "alarme",
        "time": "temps",
        "counter": "compteur",
        "input_output": "entree/sortie",
        "electric": "mesure electrique",
    }
    return len(matched), ", ".join(labels.get(item, item) for item in sorted(matched))


def segment_ranges(suggestions):
    ranges = []
    for suggestion in suggestions:
        ranges.append((suggestion[2], suggestion[3]))
        if len(suggestion) > 7 and suggestion[6] is not None and suggestion[7] is not None:
            ranges.append((suggestion[6], suggestion[7]))
    return ranges


def range_overlaps(start, end, ranges):
    return any(not (end < used_start or start > used_end) for used_start, used_end in ranges)


def support_suspect_segments(frame, existing_suggestions, support_context):
    concepts = support_context.get("concepts", set())
    if not concepts or frame["cmd"] not in {"05", "06"}:
        return []

    existing_concepts = set()
    for suggestion in existing_suggestions:
        existing_concepts.update(suggestion_concepts(suggestion))
    missing_concepts = concepts - existing_concepts
    if not missing_concepts:
        return []

    used_ranges = segment_ranges(existing_suggestions)
    bytes_list = frame["bytes"]
    candidates = []
    seen_ranges = set()

    def add_candidate(base, label, start, end, field_type, visual_type):
        if start < 0 or end >= len(bytes_list) or start > end:
            return
        if (start, end) in seen_ranges or range_overlaps(start, end, used_ranges):
            return
        seen_ranges.add((start, end))
        candidates.append((base, label, start, end, field_type, visual_type))

    if missing_concepts & {"period", "time", "batch"}:
        for i in range(max(0, frame.get("cmd_index", 0) + 1), len(bytes_list) - 1):
            raw = bytes_list[i] + bytes_list[i + 1]
            value = int(raw, 16)
            if 1 <= value <= 1440:
                add_candidate(f"support_time_{i}", "@delayLabel", i, i + 1, "timeVal", "timeSlider")
            if len(candidates) >= 2:
                break

    if missing_concepts & {"threshold", "alarm", "electric"}:
        for i in range(max(0, frame.get("cmd_index", 0) + 1), len(bytes_list) - 1):
            raw = bytes_list[i] + bytes_list[i + 1]
            value = int(raw, 16)
            if value in {0, 0xFFFF}:
                continue
            if 1 <= value <= 0xFFFE:
                add_candidate(f"support_threshold_{i}", "@thresholdLabel", i, i + 1, "hex2B", "slider")
            if len(candidates) >= 4:
                break

    return candidates[:4]
