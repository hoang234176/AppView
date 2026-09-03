class TreeNode {
  final String name;
  final String path;
  final List<TreeNode> children;

  TreeNode({
    required this.name,
    required this.path,
    this.children = const [],
  });

  factory TreeNode.fromJson(Map<String, dynamic> json) {
    var rawChildren = json['children'];
    List<TreeNode> childrenList = [];
    if (rawChildren is List) {
      childrenList = rawChildren
          .whereType<Map<String, dynamic>>()
          .map((c) => TreeNode.fromJson(c))
          .toList();
    }
    return TreeNode(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      children: childrenList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'children': children.map((c) => c.toJson()).toList(),
    };
  }

  bool get hasChildren => children.isNotEmpty;
}
