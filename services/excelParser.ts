export const parseHtmlFile = (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file."));
      }
      try {
        const htmlString = event.target.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        const tables = doc.querySelectorAll('table');
        if (tables.length === 0) {
            return reject(new Error("No tables found in the HTML file."));
        }

        const requiredHeaders = ["Step Order", "Procedure", "Expected Outcome"];
        let targetTable: HTMLTableElement | null = null;
        
        for (const table of tables) {
            const headerRow = table.querySelector('tr');
            if (headerRow) {
                const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '');
                if (requiredHeaders.every(h => headers.includes(h))) {
                    targetTable = table;
                    break;
                }
            }
        }

        if (!targetTable) {
            return reject(new Error(`Could not find a table with the required headers: "${requiredHeaders.join(', ')}".`));
        }
        
        const rows = Array.from(targetTable.querySelectorAll('tr'));
        const tableData = rows.map(row => 
            Array.from(row.children).map(cell => (cell as HTMLElement).innerHTML || "")
        );
        
        resolve(tableData);

      } catch (error) {
        reject(new Error("Error parsing HTML file. Please ensure it's a valid .html file."));
      }
    };

    reader.onerror = (error) => {
      reject(new Error("Error reading file: " + error));
    };

    reader.readAsText(file);
  });
};