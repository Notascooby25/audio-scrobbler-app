from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.blocks import (
    BlockCreateRequest,
    BlockCreateResponse,
    BlockedItemResponse,
    BlockedItemsResponse,
    DeleteEntriesRequest,
    DeleteEntriesResponse,
)
from ..services import blocks_service

router = APIRouter(tags=["blocks"])


@router.get("/users/me/blocks", response_model=BlockedItemsResponse)
def list_blocks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> BlockedItemsResponse:
    return BlockedItemsResponse(blocks=[BlockedItemResponse.model_validate(block) for block in blocks_service.list_blocks(db, current_user.id)])


@router.post("/users/me/blocks", response_model=BlockCreateResponse, status_code=status.HTTP_201_CREATED)
def create_block(
    payload: BlockCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BlockCreateResponse:
    try:
        block, hidden_count = blocks_service.create_block(db, current_user.id, payload.entity_type, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return BlockCreateResponse(block=BlockedItemResponse.model_validate(block), hidden_count=hidden_count)


@router.delete("/users/me/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    if not blocks_service.remove_block(db, current_user.id, block_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/library/delete-entries", response_model=DeleteEntriesResponse)
def delete_entries(
    payload: DeleteEntriesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeleteEntriesResponse:
    try:
        deleted = blocks_service.delete_entries(db, current_user.id, payload.entity_type, payload.name, payload.secondary)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DeleteEntriesResponse(deleted=deleted)
