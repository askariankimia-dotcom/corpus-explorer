import json
from urllib.request import Request, urlopen

prompt = (
    "In 'the penguin’s feathers', identify the possessor "
    "and the possessed entity. Answer in two short sentences."
)

payload = {
    "model": "qwen3:4b-instruct",
    "messages": [
        {
            "role": "user",
            "content": prompt
        }
    ],
    "stream": False,
    "options": {
        "num_ctx": 4096,
        "num_predict": 150,
        "temperature": 0
    }
}

request = Request(
    url="http://127.0.0.1:11434/api/chat",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

print("Waiting for the local model...")

with urlopen(request, timeout=120) as response:
    result = json.loads(response.read().decode("utf-8"))

print(result["message"]["content"])
