
namespace FabCollectionTool.Cardmarket
{
    internal class CardmarketIrregularCardname
    {
        public string Setcode { get; set; } = "";
        public string GeneratedCardname { get; set; } = "";
        public string FixedCardname { get; set; } = "";

        internal static List<CardmarketIrregularCardname> LoadFromFile(string v)
        {
            List<CardmarketIrregularCardname> list = new List<CardmarketIrregularCardname>();
            if (File.Exists(v))
            {
                // parse JSON file to list of objects
                string json = File.ReadAllText(v);
                list 
                    = System.Text.Json.JsonSerializer
                        .Deserialize<List<CardmarketIrregularCardname>>(json) 
                    ?? new List<CardmarketIrregularCardname>();
            }
            return list;
        }
    }
}
