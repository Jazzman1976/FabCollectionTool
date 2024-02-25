using FabCollectionTool.Classes;
using FabCollectionTool.Fabrary;

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
            FabraryDto? existingFabraryDto = list.FirstOrDefault(
                fDto
                => (ignoreEdition.Contains(dto.Edition) || fDto.Edition == dto.Edition)
                && fDto.SetNumber == dto.Id
                && fDto.Name == dto.Name
                && fDto.Treatment == dto.ArtTreatment
                && fDto.Foiling == foiling);

            // add if not existing
            if (existingFabraryDto == null)
            {
                list.Add(new(dto)
                {
                    Foiling = foiling,
                    Have = count
                });
                return;
            }

            // update if existing
            existingFabraryDto.Have += count;
        }
    }
}
