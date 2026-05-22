import asyncio
from browser_use import Agent
from browser_use.llm.google.chat import ChatGoogle

GOOGLE_API_KEY = 'AIzaSyBqf5WJ4anaGW02qTMO8b_5YrolGuvOCCE'
STUDY_URL = (
    'https://stanford-soil.github.io/can_you/experiments/norming_study/index.html'
    '?PROLIFIC_PID=gemini-browser&STUDY_ID=test&SESSION_ID=test'
)

TASK = f"""
You are a participant completing a psychology experiment. Visit this URL: {STUDY_URL}

Follow these steps:
1. Complete the security check (click Continue when the captcha is done)
2. Read and accept the consent form
3. Read through all instruction pages and click Continue on each
4. Complete the practice trial by interacting with the grid/slider as instructed
5. Complete at least 5 real trials — for each one, interact with the grid or sliders
   to give your honest estimates of how many of 100 people would be able/willing
   to do the described action, then click Submit
6. On the demographics page, fill in reasonable answers (age: 25, any gender, etc.)
7. Complete the study through to the final confirmation screen

Take your time on each trial and interact naturally with the interface.
"""

async def main():
    llm = ChatGoogle(
        model='gemini-2.5-flash',
        api_key=GOOGLE_API_KEY,
    )
    agent = Agent(task=TASK, llm=llm)
    result = await agent.run(max_steps=80)
    print(result)

if __name__ == '__main__':
    asyncio.run(main())
