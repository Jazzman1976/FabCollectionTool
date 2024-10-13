using FabCollectionTool.Classes;
using FabCollectionTool.Fabrary;
using static FabCollectionTool.Fabrary.FabraryConstants;

namespace FabCollectionTool.Extensions
{
    public static class FabraryDtoListExtensions
    {
        public static void AddOrUpdate(
            this List<FabraryDto> list, DataDto dto)
        {
            // in Fabrary, every card variant has an own row
            // so we have to add a new row depending on foiling
            // since different art treatments are different dtos this will also work for
            // all different art treatments
            // Fabrary does not differentiate between language variants!

            AddOrUpdateSetCardArtVariant(list, dto, Foiling.STANDARD);
            AddOrUpdateSetCardArtVariant(list, dto, Foiling.RAINBOW);
            AddOrUpdateSetCardArtVariant(list, dto, Foiling.COLD);
            AddOrUpdateSetCardArtVariant(list, dto, Foiling.GOLD);
        }

        private static FabraryDto? GetExistingFabraryDto(
            this List<FabraryDto> list, DataDto dto, string foiling)
        {
            FabraryDto? existingFabraryDto = list
                .FirstOrDefault(fDto
                    // Language variants are merged in Fabrary.
                    // Editions like first, alpha, unlimmited are seperated in Fabrary.
                    // So we also merge it if it is a language variant, which we trade like an
                    // edition in our cards.ods
                    // If it is any other edition we keep it seperated.
                    // There are no mixes of both! Every "alpha, first or unlimmited" edition was 
                    // always english, every multi-language cards have no other editions!
                    => (new[] { "DE", "FR", "ES", "IT", "JP" }.Contains(fDto.Edition) 
                        || (string.IsNullOrEmpty(fDto.Edition) && dto.Edition == "EN") 
                        || fDto.Edition == dto.Edition)
                    && fDto.SetNumber == dto.Id
                    && fDto.Foiling == foiling
                    // create an entry for every different art treatment!
                    && fDto.Treatment == dto.ArtTreatment);
            return existingFabraryDto;
        }

        private static void AddOrUpdateSetCardArtVariant(
            this List<FabraryDto> list, DataDto dto, string foiling)
        {
            // get count depending on foiling
            int count = 0;
            switch (foiling)
            {
                case Foiling.STANDARD:
                    count = dto.ST;
                    break;
                case Foiling.RAINBOW:
                    count = dto.RF;
                    break;
                case Foiling.COLD:
                    count = dto.CF;
                    break;
                case Foiling.GOLD:
                    count = dto.GF;
                    break;
            }

            // update existing or create new
            FabraryDto? existingFabraryDto = list.GetExistingFabraryDto(dto, foiling);
            if (existingFabraryDto != null)
            {
                // e.g. different language versions are merged together in Fabrary
                existingFabraryDto.Have += count;
            }
            else
            {
                list.Add(new(dto)
                {
                    Foiling = foiling,
                    Have = count
                });
            }
        }

        public static void SetExtrasForTrade(
            this List<FabraryDto> list, DataDto dto, ImportResult import)
        {
            // get how much have in this set
            int haveSet = import.GetHaveSet(dto);

            // only continue if cards to trade left
            if (haveSet <= 0)
            {
                return;
            }

            // local function to could foil variants
            int CountVariant(string foiling)
            {
                int count = import.DataDtos
                    .Where(dataDto
                        => dataDto.Id == dto.Id
                        && dataDto.ArtTreatment == dto.ArtTreatment)
                    .Sum(dataDto
                        => foiling == Foiling.STANDARD ? dataDto.ST
                        : foiling == Foiling.RAINBOW ? dataDto.RF
                        : foiling == Foiling.COLD ? dataDto.CF
                        : dataDto.GF);
                return count;
            }

            // count variants
            int goldCount = CountVariant(Foiling.GOLD);
            int coldCount = CountVariant(Foiling.COLD);
            int rainbowCount = CountVariant(Foiling.RAINBOW);
            int standardCount = CountVariant(Foiling.STANDARD);

            // calculate how much to keep at least
            int keepBase
                // if it is history pack, trade all, but not more than a playset with other sets
                = dto.IsHistory ? Math.Max(0, dto.Playset - import.GetLeftTotal(dto))
                // if it is a reprint, keep at least one card
                : dto.IsReprint ? Math.Max(1, dto.Playset - import.GetLeftTotal(dto))
                // keep a full playset otherwise
                : dto.Playset;
            int keepST = Math.Max(keepBase - (goldCount + coldCount + rainbowCount), 0);
            int keepRF = Math.Max(keepBase - (goldCount + coldCount), 0);
            int keepCF = Math.Max(keepBase - goldCount, 0);
            int keepGF = keepBase;

            // calculate how much left for trade
            int tradeST = Math.Max(0, standardCount - keepST);
            int tradeRF = Math.Max(0, rainbowCount - keepRF);
            int tradeCF = Math.Max(0, coldCount - keepCF);
            int tradeGF = Math.Max(0, goldCount - keepGF);

            FabraryDto? stDto = list.GetExistingFabraryDto(dto, Foiling.STANDARD);
            if (stDto != null) 
            {
                stDto.ExtraForTrade = tradeST;
            }

            FabraryDto? rfDto = list.GetExistingFabraryDto(dto, Foiling.RAINBOW);
            if (rfDto != null)
            {
                rfDto.ExtraForTrade = tradeRF;
            }

            FabraryDto? cfDto = list.GetExistingFabraryDto(dto, Foiling.COLD);
            if (cfDto != null)
            {
                cfDto.ExtraForTrade = tradeCF;
            }

            FabraryDto? gfDto = list.GetExistingFabraryDto(dto, Foiling.GOLD);
            if (gfDto != null)
            {
                gfDto.ExtraForTrade = tradeGF;
            }
        }
    }
}
