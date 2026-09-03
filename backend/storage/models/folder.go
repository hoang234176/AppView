package models

// FolderItem đại diện cho 1 thư mục con cấp 1
type FolderItem struct {
	Name string `json:"name"` // Tên thư mục (vd: "school", "travel")
	Path string `json:"path"` // Đường dẫn tương đối (vd: "school")
	Type string `json:"type"` // Luôn là "folder"
}

// FolderNode dùng cho cây danh mục đệ quy (Sidebar)
type FolderNode struct {
	Type     string        `json:"type"`               // Luôn là "folder"
	Name     string        `json:"name"`               // Tên hiển thị (vd: "school")
	Path     string        `json:"path"`               // Path tương đối (vd: "school")
	Children []*FolderNode `json:"children,omitempty"` // Thư mục con lồng nhau
}
