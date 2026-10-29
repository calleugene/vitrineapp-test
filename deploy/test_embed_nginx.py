import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('embed_nginx', Path(__file__).with_name('install-embed-nginx.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EmbedNginxTest(unittest.TestCase):
    def test_idempotent_patch_preserves_existing_config(self):
        text = '''server {
 listen 443 ssl;
 server_name vitrineapp.ru www.vitrineapp.ru;
 root /var/www/vitrina/public_html;
 location ^~ /methodist/ { try_files $uri /methodist/index.html; }
 location /custom/ { return 418; }
}
'''
        result = module.patch_vhost(text)
        self.assertEqual(module.patch_vhost(result), result)
        self.assertIn('location /custom/ { return 418; }', result)
        self.assertIn('frame-ancestors', result)
        self.assertEqual(result.count('include /etc/nginx/snippets/vitrina-embed.conf;'), 1)

    def test_unknown_or_ambiguous_config_is_not_modified(self):
        for text in ['', 'root /other;', 'listen 443; root /var/www/vitrina/public_html;']:
            with self.assertRaises(ValueError):
                module.patch_vhost(text)


if __name__ == '__main__':
    unittest.main()
