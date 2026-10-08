import pytest
from src.agentic.tools.scraper import MarketResearchScraper

@pytest.mark.asyncio
async def test_ddgs_news_search():
    scraper = MarketResearchScraper()
    results = await scraper.search_ddgs_news("RELIANCE stock NSE", limit=2)
    assert isinstance(results, list)
    if results:
        assert "title" in results[0]
        assert "link" in results[0]
        assert "source" in results[0]

@pytest.mark.asyncio
async def test_multi_source_symbol_fetch():
    scraper = MarketResearchScraper()
    results = await scraper.fetch_news_by_symbol("TCS", limit=3)
    assert isinstance(results, list)
    assert len(results) > 0
    assert "title" in results[0]
