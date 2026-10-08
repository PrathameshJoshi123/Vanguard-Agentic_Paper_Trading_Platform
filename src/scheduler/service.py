import asyncio
import logging
from datetime import datetime
from typing import Callable, List, Optional
import zoneinfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.settlement.mis_squareoff import MISSquareOffManager, MISSquareOffResult

logger = logging.getLogger(__name__)

IST = zoneinfo.ZoneInfo("Asia/Kolkata")


class TradingSchedulerService:
    """
    Background scheduler for automated daily trading workflows (APScheduler).
    Specifically schedules deterministic MIS auto square-off at 15:20:00 IST.
    """

    def __init__(
        self,
        square_off_manager: MISSquareOffManager,
        square_off_hour: int = 15,
        square_off_minute: int = 20,
        square_off_second: int = 0,
    ):
        self.square_off_manager = square_off_manager
        self.square_off_hour = square_off_hour
        self.square_off_minute = square_off_minute
        self.square_off_second = square_off_second
        self.scheduler = AsyncIOScheduler(timezone=IST)
        self._is_running = False

    def start(self) -> None:
        """Starts the APScheduler background thread/loop and registers jobs."""
        if self._is_running:
            return

        trigger = CronTrigger(
            hour=self.square_off_hour,
            minute=self.square_off_minute,
            second=self.square_off_second,
            timezone=IST,
        )

        self.scheduler.add_job(
            func=self._run_mis_squareoff,
            trigger=trigger,
            id="mis_daily_square_off",
            name="Daily MIS 15:20 Auto Square-Off",
            replace_existing=True,
        )

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            self.scheduler._eventloop = loop

        self.scheduler.start()
        self._is_running = True
        logger.info(
            f"TradingSchedulerService started with MIS square-off at "
            f"{self.square_off_hour:02d}:{self.square_off_minute:02d}:{self.square_off_second:02d} IST."
        )

    def stop(self) -> None:
        """Gracefully shuts down the scheduler."""
        if not self._is_running:
            return
        self.scheduler.shutdown(wait=False)
        self._is_running = False
        logger.info("TradingSchedulerService stopped.")

    def trigger_now(self) -> List[MISSquareOffResult]:
        """Manually or simulation-driven execution of MIS square-off."""
        return self._run_mis_squareoff()

    def _run_mis_squareoff(self) -> List[MISSquareOffResult]:
        logger.info("Scheduler executing MIS square-off job...")
        results = self.square_off_manager.square_off_all_mis()
        logger.info(f"Scheduler completed MIS square-off. Closed {len(results)} positions.")
        return results

    @property
    def is_running(self) -> bool:
        return self._is_running
