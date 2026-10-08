import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/folder_item.dart';

void main() {
  group('FolderItem previews parsing', () {
    test('parses previews list from json', () {
      final json = {
        'name': 'Cosplay',
        'path': 'Cosplay',
        'type': 'folder',
        'previews': [
          'http://localhost:8080/thumbnails/HDD/Cosplay/001.jpg',
          'http://localhost:8080/thumbnails/HDD/Cosplay/002.jpg',
        ],
      };

      final folder = FolderItem.fromJson(json);
      expect(folder.name, 'Cosplay');
      expect(folder.path, 'Cosplay');
      expect(folder.previews.length, 2);
      expect(folder.previews[0], 'http://localhost:8080/thumbnails/HDD/Cosplay/001.jpg');
    });

    test('handles empty or missing previews safely', () {
      final json = {
        'name': 'EmptyFolder',
        'path': 'EmptyFolder',
        'type': 'folder',
      };

      final folder = FolderItem.fromJson(json);
      expect(folder.previews, isEmpty);
    });
  });
}
