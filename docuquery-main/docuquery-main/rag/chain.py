from langchain_google_genai import ChatGoogleGenerativeAI


_histories = {}


def _format_history(history):
    recent = history[-8:]
    if not recent:
        return "No previous conversation."

    return "\n".join(
        f"{message['role'].capitalize()}: {message['content']}" for message in recent
    )


def get_answer(session_id, question, context_chunks):
    history = _histories.setdefault(session_id, [])
    joined_context = "\n\n".join(context_chunks)

    prompt = f"""You are a helpful assistant. Answer the user's question using ONLY the context below. 
If the answer is not in the context, say "I couldn't find that in the document."
Always end your answer with a line: "Source: [relevant quote from context, max 20 words]"

Context:
{joined_context}

Conversation so far:
{_format_history(history)}

Question: {question}"""

    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    response = llm.invoke(prompt)
    answer = response.content if hasattr(response, "content") else str(response)

    history.append({"role": "user", "content": question})
    history.append({"role": "assistant", "content": answer})

    return answer


def clear_session(session_id):
    _histories.pop(session_id, None)
