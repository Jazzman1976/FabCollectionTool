using CsvHelper.Configuration.Attributes;
using FabCollectionTool.Classes;
using FabCollectionTool.Extensions;

namespace FabCollectionTool.Fabrary
{
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
                ?.Replace('|', '-')
                ?.ToLower();

            Name = dataDto.Name.Replace("||", " // ");
            Pitch = dataDto.Pitch;
            Set = dataDto.Set;
            SetNumber = dataDto.Id;
            Edition = new[] { "EN", "DE", "FR", "ES", "IT", "JP" }.Contains(dataDto.Edition) ? null : dataDto.Edition; // no language variants in fabrary but alpha, unlimited, etc. !
            Foiling = null;
            Treatment = dataDto.ArtTreatment;
            Have = null;
            WantInTrade = null;
            WantToBuy = null;
            ExtraForTrade = null;
            ExtraForSell = null;
        }
    }
}
