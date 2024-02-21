using Newtonsoft.Json;

namespace FabCollectionTool.Classes
{
    public static class CardmarketHelper
    {
        public static string GetName(
            string setcode, string cardname, string pitch, CardVariant variant)
        {
            string name
                = cardname.Trim()
                + (!string.IsNullOrWhiteSpace(pitch)
                    ? $" ({pitch.Trim()})"
                    : "");

            name += variant switch
            {
                CardVariant.Regular => " (Regular)",
                CardVariant.RainbowFoil => " (Rainbow Foil)",
                CardVariant.ColdFoil => " (Cold Foil)",
                CardVariant.ColdFoilGolden => " (Cold Foil Golden)",
                _ => ""
            };

            string filename = "cardmarket-irregular-cardnames.json";
            if (!File.Exists(filename))
            {
                using StreamWriter sw = File.CreateText(filename);
                sw.Write(@"[
  {
    ""Setcode"": ""Setcode1"",
    ""GeneratedCardname"": ""GeneratedName1"",
    ""FixedCardname"": ""FixedName1""
  },
  {
    ""Setcode"": ""Setcode2"",
    ""GeneratedCardname"": ""GeneratedName2"",
    ""FixedCardname"": ""FixedName2""
  }
]");
            }

            string json = File.ReadAllText(filename);
            List<CardmarketFixedCardnameDto> fixedCarnames
                = JsonConvert.DeserializeObject<List<CardmarketFixedCardnameDto>>(json)
                ?? new List<CardmarketFixedCardnameDto>();

            if (fixedCarnames.Any(fc 
                => fc.GeneratedCardname == name
                && fc.Setcode == setcode))
            {
                return fixedCarnames.First(fc => fc.GeneratedCardname == name).FixedCardname;
            }

            return name;
        }
    }

    public enum CardVariant
    {
        None,
        Regular,
        RainbowFoil,
        ColdFoil,
        ColdFoilGolden
    }
}
