"""
ETL Operations Router
API endpoints for data fetching and processing
"""

from fastapi import APIRouter, HTTPException, Query, Path, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from services.etl_service import ETLService

router = APIRouter()

# Pydantic models
class ETLJobRequest(BaseModel):
    indicator_ids: Optional[List[int]] = None
    category: Optional[str] = None
    source: Optional[str] = None
    force_refresh: bool = False

class ETLJobResponse(BaseModel):
    job_id: str
    status: str
    started_at: str
    total_indicators: int
    message: str

class ETLResult(BaseModel):
    job_id: str
    status: str
    total_indicators: int
    successful: int
    failed: int
    blocked: int
    details: List[Dict[str, Any]]
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[float]

@router.post("/etl/jobs", response_model=ETLJobResponse)
async def create_etl_job(
    request: ETLJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Create and start an ETL job
    
    Options:
    - indicator_ids: Process specific indicators
    - category: Process all indicators in category (e.g., "Macro")
    - source: Process all indicators from source (e.g., "FRED")
    - force_refresh: Force refresh even if recently updated
    """
    try:
        service = ETLService()
        
        # Validate request
        if not request.indicator_ids and not request.category and not request.source:
            raise HTTPException(
                status_code=400,
                detail="Must specify indicator_ids, category, or source"
            )
        
        # Create job
        job = await service.create_job(
            indicator_ids=request.indicator_ids,
            category=request.category,
            source=request.source,
            force_refresh=request.force_refresh
        )
        
        # Start processing in background
        background_tasks.add_task(
            service.process_job,
            job_id=job["job_id"]
        )
        
        return ETLJobResponse(
            job_id=job["job_id"],
            status=job["status"],
            started_at=job["started_at"],
            total_indicators=job["total_indicators"],
            message=job["message"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create ETL job: {str(e)}"
        )

@router.get("/etl/jobs/{job_id}", response_model=ETLResult)
async def get_etl_job_status(
    job_id: str = Path(..., description="ETL Job ID")
):
    """
    Get ETL job status and results
    """
    try:
        service = ETLService()
        result = await service.get_job_result(job_id)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"ETL job {job_id} not found"
            )
            
        return ETLResult(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch job status: {str(e)}"
        )

@router.get("/etl/jobs")
async def list_etl_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(50, description="Maximum number of jobs")
):
    """
    List recent ETL jobs
    """
    try:
        service = ETLService()
        jobs = await service.list_jobs(status=status, limit=limit)
        
        return {
            "status": "success",
            "jobs": jobs,
            "count": len(jobs)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch jobs: {str(e)}"
        )

@router.post("/etl/indicators/{indicator_id}/fetch")
async def fetch_single_indicator(
    indicator_id: int = Path(..., description="Indicator ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    force_refresh: bool = Query(False, description="Force refresh data")
):
    """
    Fetch data for a single indicator
    
    - start_date/end_date: Specify date range for historical data
    - force_refresh: Override existing data
    """
    try:
        service = ETLService()
        
        # Parse dates
        start_dt = None
        end_dt = None
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        result = await service.fetch_indicator_data(
            indicator_id=indicator_id,
            start_date=start_dt,
            end_date=end_dt,
            force_refresh=force_refresh
        )
        
        return {
            "status": "success",
            "indicator_id": indicator_id,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch indicator data: {str(e)}"
        )

@router.post("/etl/category/{category_name}/fetch-all")
async def fetch_category_indicators(
    category_name: str = Path(..., description="Category name (Macro, Micro, etc.)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    importance_min: int = Query(1, description="Minimum importance level"),
    background_tasks: BackgroundTasks = None
):
    """
    Fetch all indicators in a category
    
    This will fetch data from start_date to end_date for all indicators
    in the specified category with importance >= importance_min
    """
    try:
        service = ETLService()
        
        # Parse dates
        start_dt = None
        end_dt = None
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        # Create job for category fetch
        job = await service.create_category_job(
            category_name=category_name,
            start_date=start_dt,
            end_date=end_dt,
            importance_min=importance_min
        )
        
        # Start processing in background
        background_tasks.add_task(
            service.process_category_job,
            job_id=job["job_id"]
        )
        
        return {
            "status": "success",
            "job_id": job["job_id"],
            "message": f"Started fetching {category_name} indicators",
            "estimated_indicators": job["total_indicators"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start category fetch: {str(e)}"
        )

@router.post("/etl/incremental/{category_name}")
async def incremental_fetch_category(
    category_name: str = Path(..., description="Category name"),
    days_back: int = Query(30, description="Number of days back to fetch"),
    background_tasks: BackgroundTasks = None
):
    """
    Incremental fetch for category (fetch recent data only)
    
    This will fetch data from the last successful date + 1 day
    up to today for all indicators in the category
    """
    try:
        service = ETLService()
        
        job = await service.create_incremental_job(
            category_name=category_name,
            days_back=days_back
        )
        
        # Start processing in background
        background_tasks.add_task(
            service.process_incremental_job,
            job_id=job["job_id"]
        )
        
        return {
            "status": "success",
            "job_id": job["job_id"],
            "message": f"Started incremental fetch for {category_name}",
            "days_back": days_back,
            "estimated_indicators": job["total_indicators"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start incremental fetch: {str(e)}"
        )

@router.get("/etl/indicators/{indicator_id}/data")
async def get_indicator_data(
    indicator_id: int = Path(..., description="Indicator ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(1000, description="Maximum number of data points")
):
    """
    Get time-series data for an indicator
    """
    try:
        service = ETLService()
        
        # Parse dates
        start_dt = None
        end_dt = None
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        data = await service.get_indicator_time_series(
            indicator_id=indicator_id,
            start_date=start_dt,
            end_date=end_dt,
            limit=limit
        )
        
        return {
            "status": "success",
            "indicator_id": indicator_id,
            "data": data,
            "count": len(data)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch indicator data: {str(e)}"
        )
