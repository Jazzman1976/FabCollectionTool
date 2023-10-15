using System.Xml.Linq;

namespace FabCollectionTool.Classes
{
    /// <summary>
    /// Maps string column names to their integer cell index number
    /// </summary>
    public class RowIndexMap
    {
        public int Set { get; set; }
        public int Edition { get; set; }
        public int FirstIn { get; set; }
        public int Id { get; set; }
        public int Rarity { get; set; }
        public int Talent { get; set; }
        public int Class1 { get; set; }
        public int Class2 { get; set; }
        public int Type1 { get; set; }
        public int Type2 { get; set; }
        public int Sub1 { get; set; }
        public int Sub2 { get; set; }
        public int ArtTreatment { get; set; }
        public int Name { get; set; }
        public int BacksideName { get; set; }
        public int Pitch { get; set; }
        public int Playset { get; set; }
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

                    case "Talent":
                        Talent = i;
                        break;

                    case "Class1":
                        Class1 = i;
                        break;

                    case "Class2":
                        Class2 = i;
                        break;

                    case "Type1":
                        Type1 = i;
                        break;

                    case "Type2":
                        Type2 = i;
                        break;

                    case "Sub1":
                        Sub1 = i;
                        break;

                    case "Sub2":
                        Sub2 = i;
                        break;

                    case "Art Treatment":
                        ArtTreatment = i;
                        break;

                    case "Name":
                        Name = i;
                        break;

                    case "Backside Name":
                        BacksideName = i;
                        break;

                    case "Pitch":
                        Pitch = i;
                        break;

                    case "Playset":
                        Playset = i;
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
}
