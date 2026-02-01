import json
from tree_sitter import Parser, Language
import tree_sitter_python as tspython

# Convert PyCapsule -> Language
PY_LANGUAGE = Language(tspython.language())

# Create parser and assign language (tree-sitter >= 0.25 API)
parser = Parser()
parser.language = PY_LANGUAGE


def extract_ast_metadata(code: str, file_path: str) -> str:
    """
    Extract basic AST metadata from Python code.
    Stable for tree-sitter 0.25.x (Windows/Linux).
    """
    metadata = {
        "file": file_path,
        "functions": [],
        "classes": []
    }

    try:
        tree = parser.parse(code.encode("utf-8"))

        def walk(node):
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    metadata["functions"].append(
                        name_node.text.decode("utf-8")
                    )

            elif node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    metadata["classes"].append(
                        name_node.text.decode("utf-8")
                    )

            for child in node.children:
                walk(child)

        walk(tree.root_node)

    except Exception as e:
        metadata["error"] = str(e)

    return json.dumps(metadata)