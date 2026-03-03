from datetime import datetime
from typing import List, Optional, Dict, Any
from models import WorkplaceRequest, RequestStatus, RequestType, RequestPriority
from Database import RequestDatabase
from ai_assistant import AIAssistant

class RequestHandler:
    def __init__(self):
        self.db = RequestDatabase()
        self.ai = AIAssistant()
    
    def create_request(self, 
                      request_type: RequestType,
                      employee_id: str,
                      employee_name: str,
                      department: str,
                      title: str,
                      description: str,
                      priority: Optional[RequestPriority] = None) -> int:
        """Create a new workplace request"""
        
        # Auto-suggest priority if not provided
        if not priority:
            priority = self.ai.suggest_priority(description)
        
        # Create request object
        request = WorkplaceRequest(
            request_type=request_type,
            employee_id=employee_id,
            employee_name=employee_name,
            department=department,
            title=title,
            description=description,
            priority=priority
        )
        
        # Save to database
        request_id = self.db.create_request(request)
        
        # Get AI analysis
        request.id = request_id
        analysis = self.ai.analyze_request(request)
        
        print(f"\n✅ Request #{request_id} created successfully!")
        print(f"Priority: {priority.value}")
        
        if analysis.get("status") == "success":
            print("\n📊 AI Analysis:")
            print(analysis.get("analysis", ""))
        
        return request_id
    
    def approve_request(self, request_id: int, approver: str) -> bool:
        """Approve a workplace request"""
        request = self.db.get_request(request_id)
        
        if not request:
            print(f"❌ Request #{request_id} not found")
            return False
        
        if request.status != RequestStatus.PENDING:
            print(f"❌ Request #{request_id} is not in pending status")
            return False
        
        # Update status
        success = self.db.update_request_status(
            request_id, 
            RequestStatus.APPROVED, 
            approver
        )
        
        if success:
            print(f"✅ Request #{request_id} approved by {approver}")
            self._trigger_fulfillment(request)
        
        return success
    
    def reject_request(self, request_id: int, reason: str) -> bool:
        """Reject a workplace request"""
        request = self.db.get_request(request_id)
        
        if not request:
            print(f"❌ Request #{request_id} not found")
            return False
        
        success = self.db.update_request_status(request_id, RequestStatus.REJECTED)
        
        if success:
            print(f"❌ Request #{request_id} rejected. Reason: {reason}")
        
        return success
    
    def get_pending_requests(self) -> List[WorkplaceRequest]:
        """Get all pending requests"""
        return self.db.get_all_requests(RequestStatus.PENDING)
    
    def get_request_details(self, request_id: int) -> Optional[WorkplaceRequest]:
        """Get detailed information about a specific request"""
        return self.db.get_request(request_id)
    
    def get_ai_recommendation(self, request_id: int) -> Dict[str, Any]:
        """Get AI recommendation for a request"""
        request = self.db.get_request(request_id)
        
        if not request:
            return {"error": "Request not found"}
        
        return self.ai.generate_approval_recommendation(request)
    
    def _trigger_fulfillment(self, request: WorkplaceRequest):
        """Trigger fulfillment process for approved requests"""
        fulfillment_actions = {
            RequestType.ACCESS_CARD: "Security team notified to issue access card",
            RequestType.EQUIPMENT: "IT team notified to prepare equipment",
            RequestType.SOFTWARE_LICENSE: "License procurement initiated",
            RequestType.PARKING_SPACE: "Facilities team notified to assign parking",
            RequestType.MEETING_ROOM: "Room booking confirmed",
            RequestType.IT_SUPPORT: "IT ticket created",
            RequestType.OFFICE_SUPPLIES: "Purchase order generated"
        }
        
        action = fulfillment_actions.get(request.request_type, "Fulfillment process initiated")
        print(f"📋 {action}")
