import { Locator, test, expect } from '../../playwright';
import {
  createCollection,
  closeAllCollections,
  createRequest,
  selectRequestPaneTab,
  openCollectionSettings,
  selectCollectionPaneTab,
  pasteIntoFocusedElement,
  buildCommonLocators
} from '../utils/page';

test.describe('EditableTable - Focus and Placeholder', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('Cursor focus restored after save and placeholder shown for empty value', async ({ page, createTmpDir }) => {
    const collectionName = 'test-editable-table';

    // Create a new collection
    await createCollection(page, collectionName, await createTmpDir());

    // Create a request
    await createRequest(page, 'Test Request', collectionName, {
      url: 'https://httpbin.org/get'
    });

    // Navigate to Params tab
    await selectRequestPaneTab(page, 'Params');

    // Find the Query params table
    const queryTable = page.locator('table').first();
    const firstRow = queryTable.locator('tbody tr').first();

    // Get the Name input (regular input)
    const nameInput = firstRow.locator('input[type="text"]').first();
    await nameInput.click();
    await page.keyboard.type('testParam');

    // Verify input has focus before save
    await expect(nameInput).toBeFocused();

    // Save the request
    const saveShortcut = process.platform === 'darwin' ? 'Meta+s' : 'Control+s';
    await page.keyboard.press(saveShortcut);

    // Wait for save toast
    await expect(page.getByText('Request saved successfully').last()).toBeVisible();

    // Verify cursor focus is restored after save
    await expect(nameInput).toBeFocused();

    // Verify placeholder shows for empty Value field
    const valueCell = firstRow.locator('[data-testid="column-value"]');
    const placeholder = valueCell.locator('pre.CodeMirror-placeholder');
    await expect(placeholder).toHaveText('Value');
  });
});

test.describe('EditableTable - Pasting a key/value pair into the key cell', () => {
  // Reading the editor's own value skips CodeMirror's measuring and placeholder nodes,
  // which show up in the rendered text.
  const editorValue = (editor: Locator) => editor.evaluate((el: any) => el.CodeMirror.getValue());

  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('Splits a pasted pair across Name and Value in a Vars table', async ({ page, createTmpDir }) => {
    const collectionName = 'test-paste-split-vars';
    await createCollection(page, collectionName, await createTmpDir());

    await openCollectionSettings(page, collectionName);
    await selectCollectionPaneTab(page, 'vars');

    const varsTable = buildCommonLocators(page).table('collection-vars-req');
    const addRow = varsTable.allRows().last();
    await varsTable.rowNameInput(addRow).click();
    await pasteIntoFocusedElement(page, '"authorization": "Bearer eyJhbGciOi"');

    const pastedRow = varsTable.rowByName('authorization');
    await expect(pastedRow).toBeVisible();
    await expect(varsTable.rowNameInput(pastedRow)).toHaveValue('authorization');
    expect(await editorValue(varsTable.rowValueEditor(pastedRow))).toBe('Bearer eyJhbGciOi');
  });

  test('Splits a pasted pair in a Headers table, where the key cell is an editor', async ({ page, createTmpDir }) => {
    const collectionName = 'test-paste-split-headers';
    await createCollection(page, collectionName, await createTmpDir());
    await createRequest(page, 'Paste Request', collectionName, { url: 'https://example.com' });

    await selectRequestPaneTab(page, 'Headers');

    const headersTable = buildCommonLocators(page).table('request-headers-table');
    const addRow = headersTable.allRows().last();
    const nameEditor = addRow.getByTestId('column-name').locator('.CodeMirror').first();
    await nameEditor.click();
    await expect(nameEditor).toHaveClass(/CodeMirror-focused/);
    await pasteIntoFocusedElement(page, '"x-api-key": "abc:123"');

    const pastedRow = headersTable.rowByName('x-api-key');
    await expect(pastedRow).toBeVisible();
    expect(await editorValue(pastedRow.getByTestId('column-name').locator('.CodeMirror').first())).toBe('x-api-key');
    // A colon inside the value survives, since only the first separator splits.
    expect(await editorValue(headersTable.rowValueEditor(pastedRow))).toBe('abc:123');
  });

  test('Leaves a pasted URL alone, since it is not an unambiguous pair', async ({ page, createTmpDir }) => {
    const collectionName = 'test-paste-url-untouched';
    await createCollection(page, collectionName, await createTmpDir());

    await openCollectionSettings(page, collectionName);
    await selectCollectionPaneTab(page, 'vars');

    const varsTable = buildCommonLocators(page).table('collection-vars-req');
    const addRow = varsTable.allRows().last();
    await varsTable.rowNameInput(addRow).click();
    await pasteIntoFocusedElement(page, 'https://example.com/graphql');

    // The scheme colon must not be treated as a separator. A synthetic paste cannot
    // insert text of its own, so what is asserted is that the table was left untouched
    // rather than that the URL landed in the cell.
    await expect(varsTable.rowByName('https')).toHaveCount(0);
    await expect(varsTable.allRows()).toHaveCount(1);
    await expect(varsTable.rowNameInput(addRow)).toHaveValue('');
    expect(await editorValue(varsTable.rowValueEditor(addRow))).toBe('');
  });

  test('Does not split a pair pasted into the Value cell, where the text may be the value', async ({ page, createTmpDir }) => {
    const collectionName = 'test-paste-value-cell';
    await createCollection(page, collectionName, await createTmpDir());

    await openCollectionSettings(page, collectionName);
    await selectCollectionPaneTab(page, 'vars');

    const varsTable = buildCommonLocators(page).table('collection-vars-req');
    const addRow = varsTable.allRows().last();
    await varsTable.rowNameInput(addRow).click();
    await page.keyboard.type('payload');

    const namedRow = varsTable.rowByName('payload');
    const valueEditor = varsTable.rowValueEditor(namedRow);
    await valueEditor.click({ force: true });
    // Without this the paste could still land on the name input, and the test would
    // pass while proving nothing.
    await expect(valueEditor).toHaveClass(/CodeMirror-focused/);
    await pasteIntoFocusedElement(page, '"authorization": "Bearer eyJhbGciOi"');

    // Only the key column splits, so the Name stays as typed and no second row appears.
    await expect(varsTable.rowNameInput(namedRow)).toHaveValue('payload');
    await expect(varsTable.rowByName('authorization')).toHaveCount(0);
  });
});
