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
    ""Setcode"": ""Setcode"",
    ""GeneratedCardname"": ""GeneratedName"",
    ""FixedCardname"": ""FixedName""
  },
  {
    ""Setcode"": ""MST"",
    ""GeneratedCardname"": ""Twelve Petal Kāṣāya"",
    ""FixedCardname"": ""Twelve Petal Kasaya""
  },
  {
    ""Setcode"": ""SUP"",
    ""GeneratedCardname"": ""Lyath Goldmane, Vile Savant // Lyath Goldmane"",
    ""FixedCardname"": ""Lyath Goldmane, Vile Savant""
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
