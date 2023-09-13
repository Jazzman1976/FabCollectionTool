using CsvHelper;
using CsvHelper.Configuration.Attributes;
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
            Console.Write("Select: [f]abrary csv style, [r]eturn to menu: ");
            string selection = Console.ReadKey().KeyChar.ToString().ToLower();
            Console.WriteLine();

            switch (selection)
            {
                case "f":
                    ParseToFabrary();
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

            var doc = XDocument.Parse(contentXml);
            XElement? headRow = doc.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").FirstOrDefault();
            var rows = doc.Descendants("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row").Skip(1);

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
                Talent1 = cellIndexValues.GetStringValue(indexMap.Talent1),
                Talent2 = cellIndexValues.GetStringValue(indexMap.Talent2),
                Class1 = cellIndexValues.GetStringValue(indexMap.Class1),
                Class2 = cellIndexValues.GetStringValue(indexMap.Class2),
                Type = cellIndexValues.GetStringValue(indexMap.Type),
                Sub1 = cellIndexValues.GetStringValue(indexMap.Sub1),
                Sub2 = cellIndexValues.GetStringValue(indexMap.Sub2),
                Treatment = cellIndexValues.GetStringValue(indexMap.Treatment),
                Name = cellIndexValues.GetStringValue(indexMap.Name),
                Pitch = cellIndexValues.GetStringValue(indexMap.Pitch),
                Playset = cellIndexValues.GetIntegerValue(indexMap.Playset),
                DS = cellIndexValues.GetIntegerValue(indexMap.DS),
                ST = cellIndexValues.GetIntegerValue(indexMap.ST),
                RF = cellIndexValues.GetIntegerValue(indexMap.RF),
                CF = cellIndexValues.GetIntegerValue(indexMap.CF),
                GF = cellIndexValues.GetIntegerValue(indexMap.GF),
            });
        }
    }

    public class RowIndexMap
    {
        public int Set { get; set; }
        public int Edition { get; set; }
        public int FirstIn { get; set; }
        public int Id { get; set; }
        public int Rarity { get; set; }
        public int Talent1 { get; set; }
        public int Talent2 { get; set; }
        public int Class1 { get; set; }
        public int Class2 { get; set; }
        public int Type { get; set; }
        public int Sub1 { get; set; }
        public int Sub2 { get; set; }
        public int Treatment { get; set; }
        public int Name { get; set; }
        public int Pitch { get; set; }
        public int Playset { get; set; }
        public int DS { get; set; }
        public int ST { get; set; }
        public int RF { get; set; }
        public int CF { get; set; }
        public int GF { get; set; }

        public RowIndexMap(XElement row)
        {
            var cells = (from c in row.Descendants()
                         where c.Name == "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-cell"
                         select c).ToList();

            var count = cells.Count;
            var j = -1;

            for (var i = 0; i < count; i++)
            {
                j++;
                var cell = cells[i];
                var attr = cell.Attribute("{urn:oasis:names:tc:opendocument:xmlns:table:1.0}number-columns-repeated");
                if (attr != null)
                {
                    var numToSkip = 0;
                    if (int.TryParse(attr.Value, out numToSkip))
                    {
                        j += numToSkip - 1;
                    }
                }

                if (i > 30) break;


                // remove comments
                cells[i].Descendants("{urn:oasis:names:tc:opendocument:xmlns:office:1.0}annotation").Remove();
                
                switch (cells[i].Value)
                {
                    case "Set":
                        Set = i;
                        break;

                    case "Edition":
                        Edition = i;
                        break;

                    case "First In":
                        FirstIn = i;
                        break;

                    case "Id":
                        Id = i;
                        break;

                    case "Rarity":
                        Rarity = i;
                        break;

                    case "Talent1":
                        Talent1 = i;
                        break;

                    case "Talent2":
                        Talent2 = i;
                        break;

                    case "Class1":
                        Class1 = i;
                        break;

                    case "Class2":
                        Class2 = i;
                        break;

                    case "Type":
                        Type = i;
                        break;

                    case "Sub1":
                        Sub1 = i;
                        break;

                    case "Sub2":
                        Sub2 = i;
                        break;

                    case "Treatment":
                        Treatment = i;
                        break;

                    case "Name":
                        Name = i;
                        break;

                    case "Pitch":
                        Pitch = i;
                        break;

                    case "Playset":
                        Playset = i;
                        break;

                    case "DS":
                        DS = i;
                        break;

                    case "ST":
                        ST = i;
                        break;

                    case "RF":
                        RF = i;
                        break;

                    case "CF":
                        CF = i;
                        break;

                    case "GF":
                        GF = i;
                        break;
                }
                
            }
        }
    }

    public class DataDto
    {
        public string? Set { get; set; }
        public string? Edition { get; set; }
        public string? FirstIn { get; set; }
        public string? Id { get; set; }
        public string? Rarity { get; set; }
        public string? Talent1 { get; set; }
        public string? Talent2 { get; set; }
        public string? Class1 { get; set; }
        public string? Class2 { get; set; }
        public string? Type { get; set; }
        public string? Sub1 { get; set; }
        public string? Sub2 { get; set; }
        public string? Treatment { get; set; }
        public string? Name { get; set; }
        public string? Pitch { get; set; }
        public int Playset { get; set; }
        public int DS { get; set; }
        public int ST { get; set; }
        public int RF { get; set; }
        public int CF { get; set; }
        public int GF { get; set; }
    }

    public class FabraryDto
    {
        public string? Identifier { get; set; }
        public string? Name { get; set; }
        public string? Pitch { get; set; }
        public string? Set { get; set; }
        [Name("Set number")]
        public string? SetNumber { get; set; }
        public string? Edition { get; set; }
        public string? Foiling { get; set; }
        public string? Treatment { get; set; }
        public int? Have { get; set; }
        [Name("Want in trade")]
        public int? WantInTrade { get; set; }
        [Name("Want to buy")]
        public int? WantToBuy { get; set; }
        [Name("Extra for trade")]
        public int? ExtraForTrade { get; set; }
        [Name("Extra to sell")]
        public int? ExtraForSell { get; set; }

        public FabraryDto(DataDto dataDto)
        {
            string? identifierRaw = !string.IsNullOrWhiteSpace(dataDto.Pitch)
                ? dataDto.Name + " " + dataDto.Pitch
                : dataDto.Name;

            Identifier = identifierRaw
                ?.Trim()
                ?.RemoveAccents()
                ?.RemoveDoubleWhitespaces()
                ?.RemoveSpecialCharacters()
                ?.Replace(' ', '-')
                ?.ToLower();

            Name = dataDto.Name;
            Pitch = dataDto.Pitch;
            Set = dataDto.Set;
            SetNumber = dataDto.Id;
            Edition = dataDto.Edition;
            Foiling = null;
            Treatment = dataDto.Treatment;
            Have = null;
            WantInTrade = null;
            WantToBuy = null;
            ExtraForTrade = null;
            ExtraForSell = null;
        }
    }

    public class ImportResult
    {
        public List<DataDto> DataDtos { get; set; } = new List<DataDto>();
    }

    public class FabraryList
    {
        public List<FabraryDto> FabraryDtos { get; set; }

        public FabraryList(ImportResult importResult) 
        {
            FabraryDtos = new List<FabraryDto>();
            foreach(DataDto dataDto in importResult.DataDtos)
            {
                if (dataDto.DS + dataDto.ST > 0)
                {
                    FabraryDto fabDto = new (dataDto)
                    {
                        Foiling = null,
                        Have = dataDto.DS + dataDto.ST
                    };
                    FabraryDtos.Add(fabDto);
                }

                if (dataDto.RF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Rainbow",
                        Have = dataDto.RF
                    };
                    FabraryDtos.Add(fabDto);
                }

                if (dataDto.CF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Cold",
                        Have = dataDto.CF
                    };
                    FabraryDtos.Add(fabDto);
                }

                if (dataDto.GF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Gold",
                        Have = dataDto.GF
                    };
                    FabraryDtos.Add(fabDto);
                }
            }
        }
    }

    public static class StringExtensions
    {
        public static string? RemoveDoubleWhitespaces(this string? str)
        {
            if (str == null) return str;
            while (str.Contains("  "))
            {
                str = str.Replace("  ", " ");
            }
            return str;
        }

        public static string? RemoveSpecialCharacters(this string? str)
        {
            if (str == null) return str;
            StringBuilder sb = new StringBuilder();
            foreach (char c in str)
            {
                if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == ' ' || c == '.' || c == '_')
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

        public static string? RemoveAccents(this string? text)
        {
            if (text == null) return text;
            StringBuilder sbReturn = new();
            var arrayText = text.Normalize(NormalizationForm.FormD).ToCharArray();
            foreach (char letter in arrayText)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(letter) != UnicodeCategory.NonSpacingMark)
                    sbReturn.Append(letter);
            }
            return sbReturn.ToString();
        }
    }

    public static class DictionaryExtensions
    {
        public static string GetStringValue(this Dictionary<int,string> dic, int i)
        {
            return dic.ContainsKey(i) 
                ? dic[i] 
                : "";
        }

        public static int GetIntegerValue(this Dictionary<int, string> dic, int i)
        {
            return dic.ContainsKey(i) 
                ? int.TryParse(dic[i], out int parsed) 
                    ? parsed 
                    : 0 
                : 0;
        }
    }
}
