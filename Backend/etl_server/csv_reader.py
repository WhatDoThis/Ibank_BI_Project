"""
Backend.etl_server.csv_reader (CSV 인코딩 감지·읽기 공용)
==========================================================
load_service, parser_file에서 사용하는 CSV 읽기 로직 통합.
인코딩 자동 감지(선택적 chardet/charset_normalizer) 또는 UTF-8 → CP949 등 순차 시도.

[Main Functions]
===========
1. _get_detector: chardet/charset_normalizer 감지기 lazy 로드
2. _read_with_pandas: pandas read_csv (C 엔진 → Python 엔진 폴백)
3. read_csv_robust: path, nrows(optional) → (DataFrame, encoding_used, data_verification_needed). 인코딩 감지 또는 순차 시도(utf-8, cp949 등).

[Dependencies]
=========
- pandas, io
- chardet 또는 charset_normalizer (선택, 없으면 순차 시도만 사용)
"""

import io
import logging
from typing import Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# 선택적 인코딩 감지: chardet 또는 charset_normalizer
_detector = None


# 1.
def _get_detector():
    global _detector
    if _detector is not None:
        return _detector
    try:
        import chardet
        _detector = ("chardet", chardet.detect)
        return _detector
    except ImportError:
        pass
    try:
        import charset_normalizer
        def _norm_detect(data: bytes):
            r = charset_normalizer.from_bytes(data).best()
            return r.encoding if r else None
        _detector = ("charset_normalizer", _norm_detect)
        return _detector
    except ImportError:
        pass
    _detector = ("none", None)
    return _detector


# 시도할 인코딩 순서 (감지 실패 시). UTF-8 BOM, EUC-KR, Latin-1 포함
_DEFAULT_ENCODINGS = ["utf-8", "utf-8-sig", "cp949", "euc-kr", "latin-1", "cp1252"]


# 2.
def _read_with_pandas(source, encoding: Optional[str], nrows: Optional[int]) -> pd.DataFrame:
    """pandas read_csv. 1차 C 엔진(고속), 실패 시 Python 엔진 폴백."""
    base_kwargs = {"nrows": nrows}
    if isinstance(source, str) and encoding:
        base_kwargs["encoding"] = encoding
    elif not isinstance(source, str) and encoding:
        base_kwargs["encoding"] = encoding
    try:
        return pd.read_csv(source, **base_kwargs, engine="c", on_bad_lines="skip")
    except (TypeError, ValueError, Exception):
        pass
    base_kwargs["engine"] = "python"
    try:
        return pd.read_csv(source, **base_kwargs, on_bad_lines="skip")
    except TypeError:
        return pd.read_csv(source, **base_kwargs, error_bad_lines=False)


# 3.
def read_csv_robust(
    file_path: str,
    nrows: Optional[int] = None,
) -> Tuple[pd.DataFrame, str, bool]:
    """
    CSV 파일을 인코딩 감지 또는 순차 시도로 읽기.
    - chardet/charset_normalizer 있으면 먼저 감지한 인코딩 시도, 없으면 UTF-8 → CP949 등 순차 시도.
    - engine=python, on_bad_lines=skip. 'unexpected end of data' 시 EOF(\\x1a) 제거 후 재시도.
    반환: (DataFrame, encoding_used, data_verification_needed).
    data_verification_needed=True 이면 EOF 제거 등 폴백으로 읽었으므로 검증 권장.
    """
    name, detect_fn = _get_detector()
    encodings_to_try: list = []

    if detect_fn and name != "none":
        try:
            with open(file_path, "rb") as f:
                raw = f.read(65536)
            if raw:
                if name == "chardet":
                    det = detect_fn(raw)
                    enc = (det or {}).get("encoding")
                else:
                    enc = detect_fn(raw)
                if enc:
                    encodings_to_try.append(enc)
        except Exception as e:
            logger.debug("csv_reader: encoding detection failed: %s", e)

    for enc in _DEFAULT_ENCODINGS:
        if enc not in encodings_to_try:
            encodings_to_try.append(enc)

    data_verification_needed = False
    last_error = None

    for encoding_used in encodings_to_try:
        try:
            df = _read_with_pandas(file_path, encoding_used, nrows)
            return (df, encoding_used, data_verification_needed)
        except Exception as e:
            err_lower = str(e).lower()
            if "unexpected end of data" in err_lower or "parsererror" in err_lower:
                try:
                    with open(file_path, "rb") as f:
                        raw = f.read()
                    cleaned = raw.rstrip(b"\x1a").decode(encoding_used, errors="replace")
                    df = _read_with_pandas(io.StringIO(cleaned), None, nrows)
                    data_verification_needed = True
                    return (df, encoding_used, data_verification_needed)
                except Exception:
                    last_error = e
                    continue
            if "unicodedecodeerror" in type(e).__name__.lower() or "decode" in err_lower:
                last_error = e
                continue
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("CSV could not be read with any attempted encoding")
