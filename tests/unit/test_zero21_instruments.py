import gzip
from pathlib import Path
import pytest
import httpx

from src.market_data.zero21.config import Zero21Config
from src.market_data.zero21.client import Zero21Client
from src.market_data.zero21.instruments import InstrumentMaster, InstrumentInfo


@pytest.fixture
def temp_config(tmp_path: Path) -> Zero21Config:
    return Zero21Config(
        ucc="HACK1234",
        password="ValidPassword",
        instruments_cache_path=str(tmp_path / "instruments.csv"),
        token_cache_path=str(tmp_path / "zero21_token.json"),
    )


def test_seed_instruments_preloaded(temp_config: Zero21Config):
    master = InstrumentMaster(config=temp_config)
    assert master.total_instruments >= 4

    rel = master.get_by_symbol("RELIANCE")
    assert rel is not None
    assert rel.token == 2885
    assert rel.exchange == "NSECM"
    assert rel.ticksize == 5
    assert rel.tick_size_rupees == 0.05
    assert rel.board_lot_quantity == 1

    tcs = master.get_by_token(11536)
    assert tcs is not None
    assert tcs.symbol == "TCS"

    assert master.symbol_to_token("INFY") == 1594
    assert master.token_to_symbol(1594) == "INFY"


def test_parse_csv_content(temp_config: Zero21Config):
    sample_csv = (
        "token,exchange,underlying_token,underlying_exchange,min_lot_size,board_lot_quantity,"
        "freeze_quantity,lower_circuit,upper_circuit,expiry,option_type,strike_price,symbol,"
        "instrument_type,isin,ticksize\n"
        "22699,NSECM,22699,NSECM,0,100,984600,9649,10663,0,,0,747HR36,STK,IN1620230376,1\n"
        "43210,NSECM,43210,NSECM,0,1,50000,100000,150000,0,,0,NEWSTOCK,STK,INE999999999,5\n"
    )

    master = InstrumentMaster(config=temp_config)
    count = master.parse_csv_content(sample_csv)
    assert count == 2

    inst = master.get_by_token(43210)
    assert inst is not None
    assert inst.symbol == "NEWSTOCK"
    assert inst.ticksize == 5
    assert inst.lower_circuit == 100000
    assert inst.upper_circuit == 150000

    # Seed instruments still accessible
    assert master.get_by_symbol("RELIANCE") is not None


@pytest.mark.asyncio
async def test_refresh_from_021_gzipped_csv(temp_config: Zero21Config):
    csv_data = (
        "token,exchange,underlying_token,underlying_exchange,min_lot_size,board_lot_quantity,"
        "freeze_quantity,lower_circuit,upper_circuit,expiry,option_type,strike_price,symbol,"
        "instrument_type,isin,ticksize\n"
        "99991,NSECM,99991,NSECM,0,1,50000,50000,75000,0,,0,ALGOSTOCK,STK,INE111111111,5\n"
    ).encode("utf-8")

    gzipped_bytes = gzip.compress(csv_data)

    def handler(request: httpx.Request):
        if request.url.path == "/api/developer-api/v1/auth/token":
            return httpx.Response(
                200,
                json={
                    "data": {"accessToken": "tok_inst", "expiresIn": 36000},
                    "success": True,
                },
            )
        elif request.url.path == "/api/developer-api/v1/instruments":
            return httpx.Response(200, content=gzipped_bytes)
        return httpx.Response(404)

    client = Zero21Client(config=temp_config)
    client._http_client = httpx.AsyncClient(
        base_url=temp_config.base_url,
        transport=httpx.MockTransport(handler),
    )

    master = InstrumentMaster(config=temp_config, client=client)
    total = await master.refresh_from_021(force=True)

    assert master.get_by_token(99991) is not None
    assert master.get_by_symbol("ALGOSTOCK").token == 99991

    # Verify cache file was written to disk
    cache_path = Path(temp_config.instruments_cache_path)
    assert cache_path.exists()
    assert "ALGOSTOCK" in cache_path.read_text()

    await client.close()
