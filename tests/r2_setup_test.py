import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

module_path = Path(__file__).resolve().parent.parent / 'scripts/configure-r2.py'
spec = importlib.util.spec_from_file_location('r2_setup', module_path)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class R2SetupValidationTests(unittest.TestCase):
    def test_exact_reported_https_domain_is_valid(self):
        value = 'https://public-blog-r2.codelily.kr'
        self.assertEqual(setup.validate_public_url(value), value)
        self.assertEqual(setup.validate_public_url(value + '/'), value)

    def test_account_is_validated_before_next_prompt_and_can_retry(self):
        with patch('builtins.input', side_effect=['not-an-account', '0' * 32]) as entered:
            with contextlib.redirect_stderr(io.StringIO()) as output:
                result = setup.ask('Account: ', setup.validate_account_id)
        self.assertEqual(result, '0' * 32)
        self.assertEqual(entered.call_count, 2)
        self.assertIn('R2_ACCOUNT_ID', output.getvalue())
        self.assertNotIn('not-an-account', output.getvalue())

    def test_domain_cannot_be_a_bucket_and_private_cannot_be_public(self):
        self.assertEqual(setup.validate_bucket('blog-storage'), 'blog-storage')
        with self.assertRaises(setup.SetupError):
            setup.validate_bucket('blog-r2.codelily.kr')
        with self.assertRaises(setup.SetupError):
            setup.validate_public_bucket('blog-storage', 'blog-storage')

    def test_bad_urls_do_not_echo_their_contents(self):
        for value in ['https://user:fixture-secret@example.invalid',
                      'https://example.invalid:fixture-secret',
                      'https://example.invalid/?token=fixture-secret',
                      'http://example.invalid',
                      'https://example.r2.dev']:
            with self.subTest(value=value):
                with self.assertRaises(setup.SetupError) as error:
                    setup.validate_public_url(value)
                self.assertNotIn('fixture-secret', str(error.exception))

    def test_existing_account_can_be_selected_without_retyping(self):
        with tempfile.TemporaryDirectory(prefix='codelily-r2-account-') as directory:
            root = Path(directory)
            (root / '.local').mkdir()
            state = root / '.local/cloudflare-baseline.json'
            state.write_text(json.dumps({'accountId': 'a' * 32}))
            self.assertEqual(setup.existing_account_id(root), 'a' * 32)
            with patch('builtins.input', return_value=''):
                self.assertEqual(setup.ask('Account: ', setup.validate_account_id,
                                          setup.existing_account_id(root)), 'a' * 32)
            state.write_text('invalid metadata')
            self.assertIsNone(setup.existing_account_id(root))

    def test_credential_validation_does_not_expose_input(self):
        with self.assertRaises(setup.SetupError) as error:
            setup.validate_credential('fixture secret with spaces')
        self.assertNotIn('fixture secret with spaces', str(error.exception))


if __name__ == '__main__':
    unittest.main()
