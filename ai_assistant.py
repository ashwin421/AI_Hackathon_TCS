import os
import httpx
import litellm
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

class AIAssistant:
    def __init__(self):
        self.api_key = os.getenv("GENAI_API_KEY")
        # Ensure the model string is prefixed for LiteLLM routing
        self.model_name = "openai/genailab-maas-gpt-4o"
        # Standard OpenAI-compatible base URL
        self.api_base = "https://genailab.tcs.in/v1" 
        
        # Configure LiteLLM to ignore SSL globally for this session
        # This is often safer for internal labs than passing a client object
        litellm.client_session = httpx.Client(verify=False)

    def _get_completion(self, messages: list, temp: float, max_tokens: int) -> Any:
        """Helper to standardize calls and avoid 'AttributeError'"""
        return litellm.completion(
            model=self.model_name,
            api_base=self.api_base,
            api_key=self.api_key,
            messages=messages,
            temperature=temp,
            max_tokens=max_tokens,
            # Instead of passing a client object that lacks an api_key attr,
            # we pass custom headers and let LiteLLM use the global session
            headers={"Authorization": f"Bearer {self.api_key}"},
            drop_params=True
        )

    def analyze_request(self, request) -> Dict[str, Any]:
        prompt = f"Analyze: {request.title}\n{request.description}"
        try:
            messages = [
                {"role": "system", "content": "You are a workplace assistant."},
                {"role": "user", "content": prompt}
            ]
            response = self._get_completion(messages, 0.3, 500)
            return {"analysis": response.choices[0].message.content, "status": "success"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    def suggest_priority(self, description: str):
        prompt = f"Suggest priority (low/medium/high/urgent) for: {description}"
        try:
            messages = [{"role": "user", "content": prompt}]
            response = self._get_completion(messages, 0.1, 10)
            priority_text = response.choices[0].message.content.strip().lower()
            return priority_text
        except Exception:
            return "medium"

    def generate_approval_recommendation(self, request) -> Dict[str, Any]:
        prompt = f"Provide approval recommendation for: {request.description}"
        try:
            messages = [{"role": "user", "content": prompt}]
            response = self._get_completion(messages, 0.2, 300)
            return {"recommendation": response.choices[0].message.content, "status": "success"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}