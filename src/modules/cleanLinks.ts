import {
  formatRemovalList,
  linkToRemove,
  LOG_HEADER,
  logRow,
  PlannedRemoval,
  summarizeSources,
} from "../core/links";
import { getString } from "../utils/locale";

const MENU_ID = "cleanurls-item-menu";
// Zotero may namespace the ID; keep the one it returns for unregistering.
let registeredMenuID: string | false = false;

export function registerItemMenu() {
  // No separator: Zotero groups plugin items under its own separator and
  // rejects the whole registration if a top-level separator is included.
  registeredMenuID = Zotero.MenuManager.registerMenu({
    menuID: MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: `${addon.data.config.addonRef}-menuitem-clean-links`,
        onCommand: (_event, context) => {
          cleanItems(context.items ?? []).catch((e) => Zotero.logError(e));
        },
      },
    ],
  });
  if (!registeredMenuID) {
    Zotero.logError(
      new Error("Clean URLs: item menu registration was rejected"),
    );
  }
}

export function unregisterItemMenu() {
  if (registeredMenuID) Zotero.MenuManager.unregisterMenu(registeredMenuID);
  registeredMenuID = false;
}

function citationLabel(item: Zotero.Item): string {
  const creator = item.getField("firstCreator") as string;
  // Multipart date: "1999-00-00 1999"
  const year = (item.getField("date", true, true) as string).slice(0, 4);
  const yearLabel = /^\d{4}$/.test(year) && year !== "0000" ? year : "n.d.";
  return `${creator || "Anonymous"} (${yearLabel})`;
}

function field(item: Zotero.Item, name: string): string {
  try {
    return (item.getField(name) as string) ?? "";
  } catch {
    // Field not valid for this item type
    return "";
  }
}

async function cleanItems(selected: Zotero.Item[]) {
  const candidates = selected.filter(
    (item) =>
      item.isRegularItem() && Zotero.Libraries.isEditable(item.libraryID),
  );

  const planned: { item: Zotero.Item; removal: PlannedRemoval }[] = [];
  for (const item of candidates) {
    const url = field(item, "url");
    const match = linkToRemove({
      itemType: item.itemType,
      url,
      DOI: field(item, "DOI"),
      extra: field(item, "extra"),
    });
    if (!match) continue;
    planned.push({
      item,
      removal: {
        citation: citationLabel(item),
        title: field(item, "title"),
        url,
        match,
      },
    });
  }

  if (!planned.length) {
    showResult(getString("clean-none", { args: { count: selected.length } }));
    return;
  }

  const removals = planned.map((p) => p.removal);
  const win = Zotero.getMainWindow();
  const ps = Services.prompt;
  // The gecko typings mark these constants optional; they always exist.
  const flags =
    ps.BUTTON_POS_0! * ps.BUTTON_TITLE_IS_STRING! +
    ps.BUTTON_POS_1! * ps.BUTTON_TITLE_CANCEL! +
    // Cancel is the default button, so Enter never deletes by accident
    ps.BUTTON_POS_1_DEFAULT!;
  const choice = ps.confirmEx(
    win as unknown as mozIDOMWindowProxy,
    getString("clean-confirm-title"),
    [
      getString("clean-confirm-intro", {
        args: { count: removals.length, sources: summarizeSources(removals) },
      }),
      "",
      formatRemovalList(removals),
      "",
      getString("clean-confirm-note"),
    ].join("\n"),
    flags,
    getString("clean-confirm-button", { args: { count: removals.length } }),
    "",
    "",
    // An empty checkbox label hides the checkbox
    "",
    { value: false },
  );
  if (choice !== 0) return;

  // Log before clearing anything, so every removed link can be restored.
  await appendToLog(planned);

  let removed = 0;
  for (const { item, removal } of planned) {
    item.setField("url", "");
    await item.saveTx();
    Zotero.debug(
      `Clean URLs: removed ${removal.match.source} link from ${item.libraryKey}`,
    );
    removed++;
  }
  showResult(getString("clean-done", { args: { count: removed } }));
}

export const LOG_FILE = "clean-urls-log.csv";

async function appendToLog(
  planned: { item: Zotero.Item; removal: PlannedRemoval }[],
) {
  const path = PathUtils.join(Zotero.DataDirectory.dir, LOG_FILE);
  const removedAt = new Date().toISOString();
  const rows = planned.map(({ item, removal }) =>
    logRow(removedAt, item.libraryKey, item.itemType, removal),
  );
  if (!(await IOUtils.exists(path))) rows.unshift(LOG_HEADER);
  await IOUtils.writeUTF8(path, rows.join("\n") + "\n", {
    mode: "appendOrCreate",
  });
}

function showResult(text: string) {
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: 5000,
  })
    .createLine({ text, type: "success" })
    .show();
}
