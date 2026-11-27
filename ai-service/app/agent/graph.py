from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes.retrieve import retrieve_code
from app.agent.nodes.analyze import analyze_code


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("retrieve_code", retrieve_code)
    graph.add_node("analyze_code", analyze_code)

    graph.add_edge(START, "retrieve_code")
    graph.add_edge("retrieve_code", "analyze_code")
    graph.add_edge("analyze_code", END)

    return graph.compile()


agent_graph = build_graph()