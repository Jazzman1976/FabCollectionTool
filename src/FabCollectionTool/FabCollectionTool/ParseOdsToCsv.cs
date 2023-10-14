using CsvHelper;
using FabCollectionTool.Classes;
using FabCollectionTool.Extensions;
using ICSharpCode.SharpZipLib.Zip;
using System.Globalization;
using System.Text;
using System.Xml.Linq;

namespace FabCollectionTool
{
    internal static class ParseOdsToCsv
    {
        public static void ShowMenu()
        {
            Console.Write(
                "Select: [f]abrary csv style, [c]ardmarket wants txt style, [r]eturn to menu: ");
            string selection = Console.ReadKey().KeyChar.ToString().ToLower();
            Console.WriteLine();

            switch (selection)
            {
                case "f":
                    ParseToFabrary();
                    break;

                case "c":
                    ParseToCardmarketDecklist(); 
                    break;

                case "r":
                    Start.ShowMainMenu();
                    break;

                default:
                    ShowMenu();
                    break;
            }
        }

        private static ImportResult? GetImportResult()
        {
            Console.Write("Path to source .ods file: ");
            string pathToSrcOds = Console.ReadLine() ?? "";

            if (!File.Exists(pathToSrcOds))
            {
                Console.WriteLine("file not found!");
                ShowMenu();
                return null;
            }

            string contentXml;
            try
            {
                contentXml = GetOdsContentXml(pathToSrcOds);
            }
            catch (Exception)
            {
                Console.WriteLine(
                    "Can't read file. Is it opened in another process? Please try again.");
                ShowMenu();
                return null;
            }

            // get XML document
            var doc = XDocument.Parse(contentXml);

            // get first table in document (cardlist)
            XElement? cardlistTable = doc.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table").FirstOrDefault();
            if (cardlistTable == null) return null;

            // get head row in this cardlist table
            XElement? headRow = cardlistTable.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").FirstOrDefault();

            // get all other rows (data rows in cardlist sheet)
            var rows = cardlistTable.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").Skip(1);

            //XElement? headRow = doc.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").FirstOrDefault();
            //var rows = doc.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").Skip(1);

            if (headRow == null) return null;

            RowIndexMap rowIndexMap = new RowIndexMap(headRow);

            ImportResult result = new ImportResult();
            foreach (var row in rows)
            {
                ImportRow(row, result, rowIndexMap);
            }

            return result;
        }

        private static void ParseToFabrary()
        {
            ImportResult? result = GetImportResult();
            if (result == null) 
            {
                ShowMenu();
                return;
            }

            FabraryList fabList = new FabraryList(result);

            using (var writer = new StreamWriter("fabrary.csv"))
            using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
            {
                csv.WriteRecords(fabList.FabraryDtos);
            }

            // end
            Console.WriteLine("fabrary.csv has been generated.");
            Start.ShowMainMenu();
        }

        private static void ParseToCardmarketDecklist()
        {
            ImportResult? result = GetImportResult();
            if (result == null)
            {
                ShowMenu();
                return;
            }

            Console.Write("Setname: ");
            string setname = Console.ReadLine() ?? "";

            CardmarketWantsList wantsList = new CardmarketWantsList(result, setname);

            using (var writer = new StreamWriter("cm-wants.txt"))
            {
                foreach(CardmarketDecklistDto dto in wantsList.CardmarketDecklistDtos) 
                {
                    string line = $"{dto.WantToBuy} {dto.Name} {dto.Pitch}".Trim();
                    writer.WriteLine(line);
                }
            }

            Console.WriteLine("cm-wants.txt has been created.");
            Start.ShowMainMenu();
        }

        private static string GetOdsContentXml(string filepath)
        {
            string? contentXml = "";
            using (FileStream fs = new FileStream(filepath, FileMode.Open, FileAccess.Read))
            {
                using var zipInputStream = new ZipInputStream(fs);
                ZipEntry? contentEntry = null;
                while ((contentEntry = zipInputStream.GetNextEntry()) != null)
                {
                    if (!contentEntry.IsFile) continue;
                    if (contentEntry.Name.ToLower() == "content.xml") break;
                }

                if (contentEntry?.Name.ToLower() != "content.xml")
                {
                    throw new Exception("Cannot find content.xml");
                }

                var bytesResult = new byte[] { };
                var bytes = new byte[2000];
                var i = 0;

                while ((i = zipInputStream.Read(bytes, 0, bytes.Length)) != 0)
                {
                    var arrayLength = bytesResult.Length;
                    Array.Resize<byte>(ref bytesResult, arrayLength + i);
                    Array.Copy(bytes, 0, bytesResult, arrayLength, i);
                }
                contentXml = Encoding.UTF8.GetString(bytesResult);
            }
            return contentXml;
        }

        private static void ImportRow(XElement row, ImportResult result, RowIndexMap indexMap)
        {
            // assure index map
            if (indexMap == null) return;

            // get cells of row
            List<XElement>? cells = (from c in row.Descendants()
                         where c.Name == "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-cell"
                         select c).ToList();

            // init cell index values dictionary
            Dictionary<int,string> cellIndexValues = new Dictionary<int,string>();

            // fill cell index values dictionary
            int count = cells.Count;
            int j = -1;
            for (var i = 0; i < count; i++)
            {
                j++;
                var cell = cells[i];
                var attr = cell.Attribute("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}number-columns-repeated");

                // there's a col with a "number-columns-repeated",
                // which says how many cols are following having the same number value
                if (attr != null)
                {
                    if (int.TryParse(attr.Value, out int numToSkip))
                    {
                        // get the value which is the same value in the following X cols
                        string repeatingCellValue = cells[i].Value;

                        if (!string.IsNullOrEmpty(repeatingCellValue))
                        {
                            // fill all following X cols with same value
                            int filled = 0;
                            while (filled < numToSkip)
                            {
                                cellIndexValues[j + filled] = repeatingCellValue;
                                filled++;
                            }
                        }

                        // set reading index pointer to next col after all skipped cols
                        j += numToSkip - 1;
                    }
                }
                else
                {
                    // standard value, no number-columns-repeated: add it to the dictionary
                    cellIndexValues[j] = cells[i].Value;
                }

                // break when nothing left to import
                if (i > 30) break;
            }

            // save DTO with cell index values
            result.DataDtos.Add(new DataDto
            {
                Set = cellIndexValues.GetStringValue(indexMap.Set),
                Edition = cellIndexValues.GetStringValue(indexMap.Edition),
                FirstIn = cellIndexValues.GetStringValue(indexMap.FirstIn),
                Id = cellIndexValues.GetStringValue(indexMap.Id),
                Rarity = cellIndexValues.GetStringValue(indexMap.Rarity),
                Talent = cellIndexValues.GetStringValue(indexMap.Talent),
                Class1 = cellIndexValues.GetStringValue(indexMap.Class1),
                Class2 = cellIndexValues.GetStringValue(indexMap.Class2),
                Type1 = cellIndexValues.GetStringValue(indexMap.Type1),
                Sub1 = cellIndexValues.GetStringValue(indexMap.Sub1),
                Sub2 = cellIndexValues.GetStringValue(indexMap.Sub2),
                ArtTreatment = cellIndexValues.GetStringValue(indexMap.ArtTreatment),
                Name = cellIndexValues.GetStringValue(indexMap.Name),
                Pitch = cellIndexValues.GetStringValue(indexMap.Pitch),
                Playset = cellIndexValues.GetIntegerValue(indexMap.Playset),
                ST = cellIndexValues.GetIntegerValue(indexMap.ST),
                RF = cellIndexValues.GetIntegerValue(indexMap.RF),
                CF = cellIndexValues.GetIntegerValue(indexMap.CF),
                GF = cellIndexValues.GetIntegerValue(indexMap.GF),
            });
        }
    }
}
