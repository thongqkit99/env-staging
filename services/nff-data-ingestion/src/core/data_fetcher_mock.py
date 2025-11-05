"""
Mock Data Fetchers for Local Development Without API Keys
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from utils.logger import get_logger

logger = get_logger(__name__)

class MockFREDDataFetcher:
    """
    Mock FRED data fetcher for local development
    Generates realistic fake data without calling real API
    NO API KEY NEEDED! ✨
    """
    
    def __init__(self):
        logger.warning("⚠️  Using MOCK FRED data fetcher (development mode - no API key needed)")
        self.base_url = "https://api.stlouisfed.org/fred"
    
    async def fetch(self, series_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """
        Generate mock data for development
        Returns list of dicts with 'date' and 'value' keys
        """
        all_series_data = []
        series_list = [s.strip() for s in series_id.split('|')] if '|' in series_id else [series_id.strip()]
        
        logger.info(f"📊 [MOCK] Generating fake data for {len(series_list)} series: {series_list}")
        
        for sid in series_list:
            df = self._generate_mock_series_data(sid, start_date, end_date)
            # Convert DataFrame to list of dicts
            for _, row in df.iterrows():
                all_series_data.append({
                    'date': row['date'],
                    'value': float(row['value'])
                })
        
        logger.info(f"✅ [MOCK] Generated {len(all_series_data)} fake data points")
        
        return all_series_data
    
    def _generate_mock_series_data(self, series_id: str, start_date: Optional[date], end_date: Optional[date]) -> pd.DataFrame:
        """Generate realistic mock data for a single series"""
        
        # Default date range
        if not start_date:
            start_date = datetime(2020, 1, 1).date()
        if not end_date:
            end_date = datetime.now().date()
        
        # Generate monthly dates
        dates = pd.date_range(start=start_date, end=end_date, freq='MS')
        
        # Get realistic base value and characteristics for this series
        base_value, volatility = self._get_series_characteristics(series_id)
        
        # Generate realistic values
        values = self._generate_realistic_time_series(len(dates), base_value, volatility)
        
        df = pd.DataFrame({
            'date': [d.date() for d in dates],
            'value': values,
            'series_id': series_id
        })
        
        logger.debug(f"[MOCK] Generated {len(df)} points for {series_id}: {base_value:.2f} ± {volatility:.2f}")
        
        return df
    
    def _get_series_characteristics(self, series_id: str) -> tuple:
        """
        Get realistic base value and volatility for different FRED series
        Returns: (base_value, volatility)
        """
        characteristics = {
            # Economic Indicators
            'CPIAUCSL': (300.0, 2.0),           # Consumer Price Index
            'GDPC1': (21000.0, 500.0),          # Real GDP
            'UNRATE': (4.0, 0.3),               # Unemployment Rate
            'PAYEMS': (155000, 200),            # Nonfarm Payrolls
            'ICSA': (220000, 15000),            # Initial Claims
            
            # Interest Rates
            'FEDFUNDS': (5.0, 0.2),             # Federal Funds Rate
            'DGS10': (4.0, 0.3),                # 10-Year Treasury
            'DGS2': (4.5, 0.3),                 # 2-Year Treasury
            'MORTGAGE30US': (7.0, 0.2),         # 30-Year Mortgage Rate
            
            # Manufacturing
            'NAPM': (50.0, 2.0),                # ISM PMI
            'INDPRO': (105.0, 1.0),             # Industrial Production
            
            # Housing
            'HOUST': (1400, 50),                # Housing Starts
            'HSN1F': (700, 30),                 # New Home Sales
            
            # Default for unknown series
            'default': (100.0, 5.0)
        }
        
        return characteristics.get(series_id, characteristics['default'])
    
    def _generate_realistic_time_series(self, n_points: int, base_value: float, volatility: float) -> list:
        """
        Generate realistic time-series with:
        - Trend (gradual increase/decrease)
        - Seasonality (cyclical pattern)
        - Random noise (volatility)
        """
        # Time index
        t = np.linspace(0, 1, n_points)
        
        # 1. Trend component (slight upward trend)
        trend = base_value * 0.05 * t
        
        # 2. Seasonality (annual cycle)
        seasonality = volatility * 0.5 * np.sin(2 * np.pi * t * 4)
        
        # 3. Random walk (market noise)
        random_walk = np.cumsum(np.random.randn(n_points) * volatility * 0.2)
        
        # 4. Random noise
        noise = np.random.randn(n_points) * volatility * 0.1
        
        # Combine all components
        values = base_value + trend + seasonality + random_walk + noise
        
        # Ensure no negative values
        values = np.maximum(values, 0.01)
        
        return values.tolist()


class MockPolygonDataFetcher:
    """Mock Polygon data fetcher for stocks"""
    
    def __init__(self):
        logger.warning("⚠️  Using MOCK Polygon data fetcher (development mode)")
    
    async def fetch(self, series_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        ticker = series_id.strip()
        logger.info(f"📊 [MOCK] Generating fake stock data for: {ticker}")
        
        if not start_date:
            start_date = datetime(2020, 1, 1).date()
        if not end_date:
            end_date = datetime.now().date()
        
        # Generate daily dates
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Generate fake stock prices with random walk
        base_price = 100.0
        daily_returns = np.random.randn(len(dates)) * 0.02  # 2% daily volatility
        prices = base_price * np.exp(np.cumsum(daily_returns))
        
        # Convert to list of dicts
        result = []
        for i, d in enumerate(dates):
            result.append({
                'date': d.date(),
                'value': float(prices[i])
            })
        
        logger.info(f"✅ [MOCK] Generated {len(result)} fake stock prices")
        return result


class MockShillerDataFetcher:
    """Mock Shiller data fetcher"""
    
    def __init__(self):
        logger.warning("⚠️  Using MOCK Shiller data fetcher (development mode)")
    
    async def fetch(self, series_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        logger.info(f"📊 [MOCK] Generating fake Shiller data for: {series_id}")
        
        if not start_date:
            start_date = datetime(2020, 1, 1).date()
        if not end_date:
            end_date = datetime.now().date()
        
        # Generate monthly dates
        dates = pd.date_range(start=start_date, end=end_date, freq='MS')
        
        # Generate fake CAPE ratio or other Shiller metrics
        base_value = 30.0  # Typical CAPE ratio
        values = base_value + np.random.randn(len(dates)) * 3
        
        # Convert to list of dicts
        result = []
        for i, d in enumerate(dates):
            result.append({
                'date': d.date(),
                'value': float(values[i])
            })
        
        logger.info(f"✅ [MOCK] Generated {len(result)} fake Shiller data points")
        return result
