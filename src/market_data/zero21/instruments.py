import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import gzip
import io
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from src.market_data.zero21.client import Zero21Client
from src.market_data.zero21.config import Zero21Config, zero21_config

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class InstrumentInfo:
    """Represents a single tradable instrument contract from the 021 master file."""
    token: int
    exchange: str
    underlying_token: int
    underlying_exchange: str
    min_lot_size: int
    board_lot_quantity: int
    freeze_quantity: int
    lower_circuit: int     # in paise
    upper_circuit: int     # in paise
    expiry: int
    option_type: str
    strike_price: int      # in paise
    symbol: str
    instrument_type: str   # STK, IDX, FUTIDX, etc.
    isin: str
    ticksize: int          # in paise

    @property
    def tick_size_rupees(self) -> float:
        return self.ticksize / 100.0

    @property
    def lower_circuit_rupees(self) -> float:
        return self.lower_circuit / 100.0

    @property
    def upper_circuit_rupees(self) -> float:
        return self.upper_circuit / 100.0


# Seed instruments to guarantee non-crashing operation even with zero network or empty cache
DEFAULT_SEED_INSTRUMENTS: List[InstrumentInfo] = [
    InstrumentInfo(
        token=2885,
        exchange="NSECM",
        underlying_token=2885,
        underlying_exchange="NSECM",
        min_lot_size=0,
        board_lot_quantity=1,
        freeze_quantity=100000,
        lower_circuit=200000,
        upper_circuit=300000,
        expiry=0,
        option_type="",
        strike_price=0,
        symbol="RELIANCE",
        instrument_type="STK",
        isin="INE002A01018",
        ticksize=5,
    ),
    InstrumentInfo(
        token=11536,
        exchange="NSECM",
        underlying_token=11536,
        underlying_exchange="NSECM",
        min_lot_size=0,
        board_lot_quantity=1,
        freeze_quantity=100000,
        lower_circuit=300000,
        upper_circuit=450000,
        expiry=0,
        option_type="",
        strike_price=0,
        symbol="TCS",
        instrument_type="STK",
        isin="INE467B01029",
        ticksize=5,
    ),
    InstrumentInfo(
        token=1594,
        exchange="NSECM",
        underlying_token=1594,
        underlying_exchange="NSECM",
        min_lot_size=0,
        board_lot_quantity=1,
        freeze_quantity=100000,
        lower_circuit=120000,
        upper_circuit=180000,
        expiry=0,
        option_type="",
        strike_price=0,
        symbol="INFY",
        instrument_type="STK",
        isin="INE009A01021",
        ticksize=5,
    ),
    InstrumentInfo(
        token=1333,
        exchange="NSECM",
        underlying_token=1333,
        underlying_exchange="NSECM",
        min_lot_size=0,
        board_lot_quantity=1,
        freeze_quantity=100000,
        lower_circuit=130000,
        upper_circuit=190000,
        expiry=0,
        option_type="",
        strike_price=0,
        symbol="HDFCBANK",
        instrument_type="STK",
        isin="INE040A01034",
        ticksize=5,
    ),
]


class InstrumentMaster:
    """
    High-Speed In-Memory Instrument Master & Token Registry.
    Provides sub-microsecond O(1) lookups:
      - token -> InstrumentInfo
      - symbol -> InstrumentInfo
      - (exchange, symbol) -> InstrumentInfo
    Supports downloading & decompressing daily CSV (~105k contracts),
    caching to local disk, and instantaneous offline recovery.
    """

    def __init__(
        self,
        config: Optional[Zero21Config] = None,
        client: Optional[Zero21Client] = None,
    ):
        self.config = config or zero21_config
        self.client = client or Zero21Client(config=self.config)

        self._by_token: Dict[int, InstrumentInfo] = {}
        self._by_symbol: Dict[str, InstrumentInfo] = {}
        self._by_exchange_symbol: Dict[Tuple[str, str], InstrumentInfo] = {}
        self._is_loaded = False

        # Load seeds first so lookup never fails
        self._load_seeds()

        # Try to load existing local cache file if available
        self._load_from_cache_file()

    def _load_seeds(self) -> None:
        """Loads default seed instruments."""
        for inst in DEFAULT_SEED_INSTRUMENTS:
            self._index_instrument(inst)

    def _index_instrument(self, inst: InstrumentInfo) -> None:
        self._by_token[inst.token] = inst
        exch = inst.exchange.upper()
        sym = inst.symbol.upper()
        self._by_exchange_symbol[(exch, sym)] = inst
        # Prioritize equity cash NSECM or first encounter
        if sym not in self._by_symbol or exch == "NSECM":
            self._by_symbol[sym] = inst

    def get_by_token(self, token: int) -> Optional[InstrumentInfo]:
        """Sub-microsecond token lookup."""
        return self._by_token.get(token)

    def get_by_symbol(self, symbol: str, exchange: Optional[str] = None) -> Optional[InstrumentInfo]:
        """Sub-microsecond symbol lookup."""
        sym = symbol.upper()
        if exchange:
            return self._by_exchange_symbol.get((exchange.upper(), sym))
        return self._by_symbol.get(sym)

    def symbol_to_token(self, symbol: str, exchange: Optional[str] = None) -> Optional[int]:
        """Translates trading symbol (e.g. RELIANCE) to token (e.g. 2885)."""
        inst = self.get_by_symbol(symbol, exchange)
        return inst.token if inst else None

    def token_to_symbol(self, token: int) -> Optional[str]:
        """Translates token to trading symbol."""
        inst = self.get_by_token(token)
        return inst.symbol if inst else None

    @property
    def total_instruments(self) -> int:
        return len(self._by_token)

    def parse_csv_content(self, csv_text: str) -> int:
        """Parses CSV text into in-memory indices."""
        reader = csv.DictReader(io.StringIO(csv_text))
        count = 0
        new_by_token: Dict[int, InstrumentInfo] = {}
        new_by_symbol: Dict[str, InstrumentInfo] = {}
        new_by_exch_sym: Dict[Tuple[str, str], InstrumentInfo] = {}

        # Retain seeds as base
        for inst in DEFAULT_SEED_INSTRUMENTS:
            new_by_token[inst.token] = inst
            new_by_symbol[inst.symbol.upper()] = inst
            new_by_exch_sym[(inst.exchange.upper(), inst.symbol.upper())] = inst

        for row in reader:
            try:
                token_val = int(row["token"])
                inst = InstrumentInfo(
                    token=token_val,
                    exchange=row.get("exchange", "NSECM").strip(),
                    underlying_token=int(row.get("underlying_token", token_val) or token_val),
                    underlying_exchange=row.get("underlying_exchange", "").strip(),
                    min_lot_size=int(row.get("min_lot_size", 0) or 0),
                    board_lot_quantity=int(row.get("board_lot_quantity", 1) or 1),
                    freeze_quantity=int(row.get("freeze_quantity", 0) or 0),
                    lower_circuit=int(row.get("lower_circuit", 0) or 0),
                    upper_circuit=int(row.get("upper_circuit", 0) or 0),
                    expiry=int(row.get("expiry", 0) or 0),
                    option_type=row.get("option_type", "").strip(),
                    strike_price=int(row.get("strike_price", 0) or 0),
                    symbol=row.get("symbol", "").strip(),
                    instrument_type=row.get("instrument_type", "STK").strip(),
                    isin=row.get("isin", "").strip(),
                    ticksize=int(row.get("ticksize", 5) or 5),
                )
                new_by_token[inst.token] = inst
                sym = inst.symbol.upper()
                exch = inst.exchange.upper()
                new_by_exch_sym[(exch, sym)] = inst
                if sym not in new_by_symbol or exch == "NSECM":
                    new_by_symbol[sym] = inst
                count += 1
            except Exception as e:
                logger.debug(f"Skipping malformed instrument row: {e}")

        self._by_token = new_by_token
        self._by_symbol = new_by_symbol
        self._by_exchange_symbol = new_by_exch_sym
        self._is_loaded = True
        logger.info(f"Loaded {len(self._by_token)} instruments into in-memory index.")
        return count

    def _load_from_cache_file(self) -> bool:
        """Loads cached instruments file from disk if present."""
        path = Path(self.config.instruments_cache_path)
        if not path.exists():
            return False
        try:
            logger.info(f"Loading cached instruments from {path}...")
            content = path.read_text(encoding="utf-8")
            count = self.parse_csv_content(content)
            logger.info(f"Successfully loaded {count} cached instruments.")
            return True
        except Exception as e:
            logger.warning(f"Failed to read instruments cache file: {e}")
            return False

    async def refresh_from_021(self, force: bool = False) -> int:
        """
        Downloads latest instruments master from 021, saves to cache, and re-indexes.
        If already loaded and not force, skips download.
        """
        if self._is_loaded and not force and len(self._by_token) > len(DEFAULT_SEED_INSTRUMENTS):
            return len(self._by_token)

        if not self.config.is_configured:
            logger.info("021 credentials not configured; using seed instruments.")
            return len(self._by_token)

        try:
            logger.info("Downloading instruments master from 021...")
            raw_data = await self.client.download_instruments_csv()

            # Handle gzip decompression
            if raw_data.startswith(b"\x1f\x8b"):
                csv_bytes = gzip.decompress(raw_data)
            else:
                csv_bytes = raw_data

            csv_text = csv_bytes.decode("utf-8", errors="replace")

            # Save to disk cache
            cache_path = Path(self.config.instruments_cache_path)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(csv_text, encoding="utf-8")

            # Parse and index
            count = self.parse_csv_content(csv_text)
            logger.info(f"021 instruments successfully synced ({count} contracts).")
            return count
        except Exception as e:
            logger.warning(f"Could not refresh instruments from 021: {e}. Retaining active index.")
            return len(self._by_token)


# Global singleton instance
instrument_master = InstrumentMaster()
