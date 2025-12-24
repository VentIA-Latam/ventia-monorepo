"""
Base repository with generic CRUD operations.
"""

from typing import Any, Generic, Type, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.base import Base

# Type variables for generic repository
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base class for CRUD operations.

    Generic repository pattern for common database operations.
    """

    def __init__(self, model: Type[ModelType]) -> None:
        """
        Initialize CRUD object with model class.

        Args:
            model: SQLAlchemy model class
        """
        self.model = model

    def get(self, db: Session, id: int) -> ModelType | None:
        """
        Get a single record by ID.

        Args:
            db: Database session
            id: Record ID

        Returns:
            Model instance or None if not found
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelType]:
        """
        Get multiple records with pagination.

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of model instances
        """
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create a new record.

        Args:
            db: Database session
            obj_in: Pydantic schema with data to create

        Returns:
            Created model instance
        """
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """
        Update an existing record.

        Args:
            db: Database session
            db_obj: Existing model instance to update
            obj_in: Pydantic schema or dict with update data

        Returns:
            Updated model instance
        """
        # Get update data as dict
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # Update model attributes
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: int) -> ModelType | None:
        """
        Delete a record by ID.

        Args:
            db: Database session
            id: Record ID to delete

        Returns:
            Deleted model instance or None if not found
        """
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    def count(self, db: Session) -> int:
        """
        Count total number of records.

        Args:
            db: Database session

        Returns:
            Total count
        """
        return db.query(self.model).count()
