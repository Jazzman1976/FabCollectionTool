namespace FabCollectionTool.Classes
{
    public class DataDto
    {
        public string Set { get; set; } = "";
        public string Edition { get; set; } = "";
        public string FirstIn { get; set; } = "";
        public string Id { get; set; } = "";
        public string Rarity { get; set; } = "";
        public string Talent { get; set; } = "";
        public string Class1 { get; set; } = "";
        public string Class2 { get; set; } = "";
        public string Type1 { get; set; } = "";
        public string Type2 { get; set; } = "";
        public string Sub1 { get; set; } = "";
        public string Sub2 { get; set; } = "";
        public string Sub3 { get; set; } = "";
        public string ArtTreatment { get; set; } = "";
        public string Name { get; set; } = "";
        public string BacksideName { get; set; } = "";
        public string Pitch { get; set; } = "";
        public string Peculiarity { get; set; } = "";
        public int Playset { get; set; }
        public int ST { get; set; }
        public int RF { get; set; }
        public int CF { get; set; }
        public int GF { get; set; }

        public bool IsReprint 
            => AbbreviationSetnameMap.Map.ContainsKey(this.FirstIn)
            && AbbreviationSetnameMap.Map[this.FirstIn] == this.Set;
    }
}
