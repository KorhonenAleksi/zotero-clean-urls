clean-none = No database or proxy links to remove in the { $count } selected items.
clean-confirm-title = Remove database links
clean-confirm-intro = { $count ->
        [one] 1 item has a database or proxy link that would appear in your reference list ({ $sources }):
       *[other] { $count } items have database or proxy links that would appear in your reference list ({ $sources }):
    }
clean-confirm-note = Only the URL field is cleared. Items with a DOI, web pages, and PDF attachments are not touched. This can't be undone.
clean-confirm-button = { $count ->
        [one] Remove 1 link
       *[other] Remove { $count } links
    }
clean-done = { $count ->
        [one] Removed 1 database link.
       *[other] Removed { $count } database links.
    }
