"""
Indicators Management Router
API endpoints for managing indicator metadata
"""

from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from services.indicator_metadata_service import IndicatorMetadataService
from services.excel_import_service import ExcelImportService

router = APIRouter()

# Pydantic models for request/response
class IndicatorMetadataResponse(BaseModel):
    id: int
    moduleEN: str
    moduleHE: Optional[str]
    indicatorEN: str
    indicatorHE: Optional[str]
    categoryId: int
    categoryName: str
    source: str
    seriesIDs: Optional[str]
    apiExample: Optional[str]
    calculation: Optional[str]
    notes: Optional[str]
    importance: int
    relevantReports: List[str]
    defaultChartType: str
    etlStatus: str
    etlStatusCode: Optional[str]
    etlNotes: Optional[str]
    lastEtlRunAt: Optional[str]
    lastSuccessfulAt: Optional[str]
    recordsCount: int
    isActive: bool
    createdAt: str
    updatedAt: str

class IndicatorImportRequest(BaseModel):
    excelPath: str
    sheetName: str = "macro"
    categoryName: str = "Macro"

class IndicatorUpdateRequest(BaseModel):
    importance: Optional[int] = None
    relevantReports: Optional[List[str]] = None
    defaultChartType: Optional[str] = None
    isActive: Optional[bool] = None
    notes: Optional[str] = None

@router.get("/indicators", response_model=List[IndicatorMetadataResponse])
async def get_indicators(
    category: Optional[str] = Query(None, description="Filter by category name"),
    source: Optional[str] = Query(None, description="Filter by data source"),
    etl_status: Optional[str] = Query(None, description="Filter by ETL status"),
    importance_min: Optional[int] = Query(None, description="Minimum importance level"),
    is_active: Optional[bool] = Query(True, description="Filter active indicators"),
    limit: int = Query(100, description="Maximum number of results"),
    offset: int = Query(0, description="Number of results to skip")
):
    """
    Get list of indicators with filtering options
    """
    try:
        service = IndicatorMetadataService()
        
        filters = {}
        if category:
            filters["category"] = category
        if source:
            filters["source"] = source
        if etl_status:
            filters["etl_status"] = etl_status
        if importance_min is not None:
            filters["importance_min"] = importance_min
        if is_active is not None:
            filters["is_active"] = is_active
            
        indicators = await service.get_indicators(
            filters=filters,
            limit=limit,
            offset=offset
        )
        
        return indicators
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch indicators: {str(e)}"
        )

@router.get("/indicators/{indicator_id}", response_model=IndicatorMetadataResponse)
async def get_indicator(
    indicator_id: int = Path(..., description="Indicator ID")
):
    """
    Get specific indicator by ID
    """
    try:
        service = IndicatorMetadataService()
        indicator = await service.get_indicator_by_id(indicator_id)
        
        if not indicator:
            raise HTTPException(
                status_code=404,
                detail=f"Indicator with ID {indicator_id} not found"
            )
            
        return indicator
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch indicator: {str(e)}"
        )

@router.post("/indicators/import")
async def import_indicators_from_excel(
    request: IndicatorImportRequest
):
    """
    Import indicators from Excel file (auto-detects local path or S3 URL)
    """
    try:
        service = ExcelImportService()
        
        # Auto-detect if it's a URL and download if needed
        excel_path = await service.get_excel_file_path(request.excelPath)
        
        result = await service.import_indicators_from_excel(
            excel_path=excel_path,
            sheet_name=request.sheetName,
            category_name=request.categoryName
        )
        
        # Clean up temporary file if it was downloaded
        if excel_path != request.excelPath:
            import os
            try:
                os.remove(excel_path)
            except:
                pass  # Ignore cleanup errors
        
        return {
            "status": "success",
            "message": f"Successfully imported {result.get('processed_count', 0)} indicators",
            "job_id": result.get('job_id', 'N/A'),
            "details": result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import indicators: {str(e)}"
        )

@router.put("/indicators/{indicator_id}")
async def update_indicator(
    indicator_id: int = Path(..., description="Indicator ID"),
    request: IndicatorUpdateRequest = None
):
    """
    Update indicator metadata
    """
    try:
        service = IndicatorMetadataService()
        
        update_data = request.dict(exclude_unset=True)
        updated_indicator = await service.update_indicator(indicator_id, update_data)
        
        return {
            "status": "success",
            "message": f"Indicator {indicator_id} updated successfully",
            "data": updated_indicator
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update indicator: {str(e)}"
        )

@router.get("/indicators/{indicator_id}/etl-logs")
async def get_indicator_etl_logs(
    indicator_id: int = Path(..., description="Indicator ID"),
    limit: int = Query(10, description="Maximum number of logs")
):
    """
    Get ETL logs for specific indicator
    """
    try:
        service = IndicatorMetadataService()
        logs = await service.get_etl_logs(indicator_id, limit)
        
        return {
            "status": "success",
            "indicator_id": indicator_id,
            "logs": logs
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch ETL logs: {str(e)}"
        )

@router.get("/indicators/by-report/{report_type_name}")
async def get_indicators_by_report_type(
    report_type_name: str = Path(..., description="Report type name"),
    include_default_only: bool = Query(True, description="Include only default indicators")
):
    """
    Get indicators for specific report type
    """
    try:
        service = IndicatorMetadataService()
        
        indicators = await service.get_indicators_for_report_type(
            report_type_name=report_type_name,
            default_only=include_default_only
        )
        
        return {
            "status": "success",
            "report_type": report_type_name,
            "indicators": indicators,
            "count": len(indicators)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch indicators for report type: {str(e)}"
        )

@router.get("/indicators/stats")
async def get_indicators_stats():
    """
    Get indicators statistics
    """
    try:
        service = IndicatorMetadataService()
        stats = await service.get_statistics()
        
        return {
            "status": "success",
            "statistics": stats
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch statistics: {str(e)}"
        )
