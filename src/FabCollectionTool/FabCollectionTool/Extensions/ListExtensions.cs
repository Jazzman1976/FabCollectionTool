using FabCollectionTool.Classes;
using FabCollectionTool.Fabrary;
using System.Collections.Generic;
using System.Net.Http.Headers;
using static FabCollectionTool.Fabrary.FabraryConstants;

namespace FabCollectionTool.Extensions
{
    public static class ListExtensions
    {       
        


        /// <summary>
        /// Adds amount of cards to existing list item or creates a new list item if not existing.
        /// </summary>
        /// <param name="dto"></param>
        /// <param name="foiling">A <see cref="FabraryConstants.Foiling"/> value</param>
        public static void AddOrUpdate(this List<FabraryDto> list, DataDto dto, string foiling)
        {
            // get count via Foiling
            int count = 0;
            switch (foiling)
            {
                case FabraryConstants.Foiling.STANDARD:
                    count = dto.ST;
                    break;
                case FabraryConstants.Foiling.RAINBOW:
                    count = dto.RF; 
                    break;
                case FabraryConstants.Foiling.COLD: 
                    count = dto.CF;
                    break;
                case FabraryConstants.Foiling.GOLD:
                    count = dto.GF;
                    break;
            }

            // find existing item
            // get only (the one) existing card fDto of current foiling
            FabraryDto? existingFabraryDto = list
                .FirstOrDefault(fDto 
                    => fDto.IsVariantOfSameCard(dto) 
                    && fDto.Foiling == foiling);

            // add if not still existing, create a new one
            if (existingFabraryDto == null)
            {
                existingFabraryDto = new(dto)
                {
                    Foiling = foiling,
                    Have = count
                };
                list.Add(existingFabraryDto);

                return;
            }
            
            // update if existing
            existingFabraryDto.Have += count;
        }

        public static void DeclareExtrasForTrade(this List<FabraryDto> list, DataDto dto)
        {
            // local function to sum extra and have to a total have
            static int sumHave(FabraryDto fDto) => fDto.Have ?? 0 + fDto.ExtraForTrade ?? 0;

            // count total haves (all variants of same card)
            int totalHaveCount = list
                .Where(fDto => fDto.IsVariantOfSameCard(dto))
                .Sum(sumHave);

            // do not add extras for trade if no playset
            if (totalHaveCount <= dto.Playset)
            {
                return;
            }

            // count all gold foils, merge different art treatments (marvels)
            int goldCount = list
                .Where(fDto 
                    => fDto.IsVariantOfSameCard(dto) 
                    && fDto.Foiling == Foiling.GOLD)
                .Sum(sumHave);
            
            // count all cold foils, merge different art treatments (marvels)
            int coldCount = list
                .Where(fDto
                    => fDto.IsVariantOfSameCard(dto)
                    && fDto.Foiling == Foiling.COLD)
                .Sum(sumHave);

            // count all rainbow foils, merge different art treatments (marvels)
            int rainbowCount = list
                .Where(fDto
                    => fDto.IsVariantOfSameCard(dto)
                    && fDto.Foiling == Foiling.RAINBOW)
                .Sum(sumHave);

            // count all no-foils, merge different art treatments (marvels)
            int standardCount = list
                .Where(fDto
                    => fDto.IsVariantOfSameCard(dto)
                    && fDto.Foiling == Foiling.STANDARD)
                .Sum(sumHave);

            foreach (FabraryDto? fDto in list.Where(fDto => fDto.IsVariantOfSameCard(dto)))
            {
                int mustKeep
                    = fDto.Foiling == Foiling.STANDARD
                        ? Math.Max(dto.Playset - (goldCount + coldCount + rainbowCount), 0)
                    : fDto.Foiling == Foiling.RAINBOW
                        ? Math.Max(dto.Playset - (goldCount + coldCount), 0)
                    : fDto.Foiling == Foiling.COLD
                        ? Math.Max(dto.Playset - goldCount, 0)
                    : dto.Playset;
                
                if (fDto.Have > mustKeep)
                {
                    // keep playset of gold foil, trade the rest
                    fDto.ExtraForTrade = fDto.Have - mustKeep;
                    fDto.Have -= fDto.ExtraForTrade;
                }
            }


            //// move to extraForTrade if more than playset
            //if ((foiling == FabraryConstants.Foiling.STANDARD
            //&& goldCount + coldCount + rainbowCount >= dto.Playset)
            //    ||
            //    (foiling == FabraryConstants.Foiling.RAINBOW
            //&& goldCount + coldCount >= dto.Playset)
            //    ||
            //    (foiling == FabraryConstants.Foiling.COLD
            //        && goldCount >= dto.Playset))
            //{
            //    existingFabraryDto.ExtraForTrade = existingFabraryDto.Have;
            //    existingFabraryDto.Have = 0;
            //}
        }
    }
}
