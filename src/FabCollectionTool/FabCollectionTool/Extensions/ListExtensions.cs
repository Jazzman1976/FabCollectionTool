using FabCollectionTool.Classes;
using FabCollectionTool.Fabrary;
using System.Net.Http.Headers;

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
            string[] ignoreEdition = new[] { "DE", "FR", "ES", "IT" };

            // common filter condition for all foiling variants
            bool filterCondition(FabraryDto fDto
)
                // if matching 'ignoreEdition', the edition can be ignored
                // e.g. HP1 cards in other cultures are added to 'standard' edition as if they
                // would not have a 'special' edition
                // need this to differentiate between 'edition' and 'culture version'
                // it's handled in the same field 'edition' in the ODS
                => (ignoreEdition.Contains(dto.Edition) || fDto.Edition == dto.Edition)
                && fDto.SetNumber == dto.Id
                && fDto.Name == dto.Name
                && fDto.Treatment == dto.ArtTreatment;

            // get only existing dto of current foiling
            FabraryDto? existingFabraryDto = list
                .Where(filterCondition)
                .FirstOrDefault(fDto => fDto.Foiling == foiling);

            // add if not still existing, create a new one
            if (existingFabraryDto == null)
            {
                existingFabraryDto = new(dto)
                {
                    Foiling = foiling,
                    Have = count
                };
                list.Add(existingFabraryDto);
            }
            else
            {
                // update if existing
                existingFabraryDto.Have += count;
            }

            // count all variant haves
            int allVariantHaveCount = list
                .Where(filterCondition)
                // get total amount of all haves in this set only, including all culture versions
                .Sum(fDto => fDto.Have + fDto.ExtraForTrade)
                ?? 0;

            // do not add extras for trade if no playset
            if (allVariantHaveCount <= dto.Playset) 
            {
                return;
            }

            // count all gold foils
            int goldCount = list
                .Where(filterCondition)
                .Where(fDto => fDto.Foiling == FabraryConstants.Foiling.GOLD)
                .Sum(fDto => fDto.Have + fDto.ExtraForTrade)
                ?? 0;
            bool haveAllinGold = goldCount >= dto.Playset;

            // count all cold foils
            int coldCount = list
                .Where(filterCondition)
                .Where(fDto => fDto.Foiling == FabraryConstants.Foiling.COLD)
                .Sum(fDto => fDto.Have + fDto.ExtraForTrade)
                ?? 0;
            bool haveAllinCold = coldCount >= dto.Playset;

            // count all rainbow foils
            int rainbowCount = list
                .Where(filterCondition)
                .Where(fDto => fDto.Foiling == FabraryConstants.Foiling.RAINBOW)
                .Sum(fDto => fDto.Have + fDto.ExtraForTrade)
                ?? 0;
            bool haveAllinRainbow = rainbowCount >= dto.Playset;

            // move to extraForTrade if more than playset
            if ((foiling == FabraryConstants.Foiling.STANDARD 
                    && goldCount + coldCount + rainbowCount >= dto.Playset) 
                ||
                (foiling == FabraryConstants.Foiling.RAINBOW 
                    && goldCount + coldCount >= dto.Playset) 
                ||
                (foiling == FabraryConstants.Foiling.COLD 
                    && goldCount >= dto.Playset))
            {
                existingFabraryDto.ExtraForTrade = existingFabraryDto.Have;
                existingFabraryDto.Have = 0;
            }
        }
    }
}
