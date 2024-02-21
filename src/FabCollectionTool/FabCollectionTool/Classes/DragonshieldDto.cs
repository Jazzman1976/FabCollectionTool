using CsvHelper.Configuration.Attributes;

namespace FabCollectionTool.Classes
{
    public class DragonshieldDto
    {
        [Name("Folder Name")]
        public string? FolderName { get; set; }
        public int? Quantity { get; set; }
        [Name("Trade Quantity")]
        public int? TradeQuantity { get; set; }
        [Name("Card Name")]
        public string? CardName { get; set; }
        [Name("Set Code")]
        public string? SetCode { get; set; }
        [Name("Set Name")]
        public string? SetName { get; set;}
        [Name("Card Number")]
        public string? CardNumber { get; set; }
        public string? Condition { get; set; }
        public string? Printing { get; set; }
        public string? Language { get; set; }
        [Name("Price Bought")]
        public string? PriceBought { get; set; }
        [Name("Date Bought")]
        public string? DateBought { get; set; }
        [Name("AVG")]
        public decimal? Avg { get; set; }
        [Name("LOW")]
        public decimal? Low { get; set; }
        [Name("TREND")]
        public decimal? Trend { get; set; }
    }
}
