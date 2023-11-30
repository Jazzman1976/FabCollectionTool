using CsvHelper.Configuration.Attributes;

namespace FabCollectionTool.TcgPowertools
{
    public class TcgDto
    {
        [Name("cardmarketId")]
        public string CardmarketId { get; set; } = "";
        [Name("quantity")]
        public int Quantity { get; set; }
        [Name("name")]
        public string Name { get; set; } = "";
        [Name("set")]
        public string Set { get; set; } = "";
        [Name("cn")]
        public string Cn { get; set; } = "";
        [Name("condition")]
        public string Condition { get; set; } = "";
        [Name("language")]
        public string Language { get; set; } = "";
        [Name("isSigned")]
        public string IsSigned { get; set; } = "";
        [Name("price")]
        public string Price { get; set; } = "1000.0"; // better to high as to low
    }
}
