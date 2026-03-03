import sqlite3
import json
from datetime import datetime
from typing import List, Optional
from models import WorkplaceRequest, RequestStatus, RequestType, RequestPriority

class RequestDatabase:
    def __init__(self, db_path: str = "workplace_requests.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with necessary tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_type TEXT NOT NULL,
                employee_id TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                department TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP,
                approved_by TEXT,
                approval_date TIMESTAMP,
                completion_date TIMESTAMP,
                notes TEXT,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS approval_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                performed_by TEXT NOT NULL,
                performed_at TIMESTAMP NOT NULL,
                comments TEXT,
                FOREIGN KEY (request_id) REFERENCES requests(id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def create_request(self, request: WorkplaceRequest) -> int:
        """Create a new request in the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO requests (
                request_type, employee_id, employee_name, department,
                title, description, priority, status, created_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            request.request_type.value,
            request.employee_id,
            request.employee_name,
            request.department,
            request.title,
            request.description,
            request.priority.value,
            request.status.value,
            request.created_at,
            json.dumps(request.metadata)
        ))
        
        request_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return request_id
    
    def get_request(self, request_id: int) -> Optional[WorkplaceRequest]:
        """Get a specific request by ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM requests WHERE id = ?', (request_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_request(row)
        return None
    
    def get_all_requests(self, status: Optional[RequestStatus] = None) -> List[WorkplaceRequest]:
        """Get all requests, optionally filtered by status"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if status:
            cursor.execute('SELECT * FROM requests WHERE status = ? ORDER BY created_at DESC', 
                         (status.value,))
        else:
            cursor.execute('SELECT * FROM requests ORDER BY created_at DESC')
        
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_request(row) for row in rows]
    
    def update_request_status(self, request_id: int, status: RequestStatus, 
                             approved_by: Optional[str] = None) -> bool:
        """Update the status of a request"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        updated_at = datetime.now()
        
        if status == RequestStatus.APPROVED and approved_by:
            cursor.execute('''
                UPDATE requests 
                SET status = ?, updated_at = ?, approved_by = ?, approval_date = ?
                WHERE id = ?
            ''', (status.value, updated_at, approved_by, updated_at, request_id))
        else:
            cursor.execute('''
                UPDATE requests 
                SET status = ?, updated_at = ?
                WHERE id = ?
            ''', (status.value, updated_at, request_id))
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    
    def _row_to_request(self, row) -> WorkplaceRequest:
        """Convert a database row to a WorkplaceRequest object"""
        return WorkplaceRequest(
            id=row[0],
            request_type=RequestType(row[1]),
            employee_id=row[2],
            employee_name=row[3],
            department=row[4],
            title=row[5],
            description=row[6],
            priority=RequestPriority(row[7]),
            status=RequestStatus(row[8]),
            created_at=row[9],
            updated_at=row[10],
            approved_by=row[11],
            approval_date=row[12],
            completion_date=row[13],
            notes=row[14],
            metadata=json.loads(row[15]) if row[15] else {}
        )
